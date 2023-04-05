/*********************************************************************************
*  WEB322 – Assignment 06
*  I declare that this assignment is my own work in accordance with Seneca  Academic Policy.  No part of this
*  assignment has been copied manually or electronically from any other source (including web sites) or 
*  distributed to other students.
* 
*  Name: Gaganpreet Singh Student ID: 164321218 Date: Apr 05, 2023
*
*  Online (Cyclic) Link: ________________________________________________________
*
********************************************************************************/ 


const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const stripJs = require('strip-js');
const blog_service = require('./blog-service');
const authData = require('./auth-service');
const clientSessions = require('client-sessions');
const app = express();

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

app.use(clientSessions({
    cookieName: "session",
    secret: "secret",
    duration: 2 * 60 * 1000,
    activeDuration: 1000 * 60
}));

app.use(function (req, res, next) {
    res.locals.session = req.session;
    next();
});

function ensureLogin(req, res, next) {
    if (!req.session.user) {
        res.redirect("/login");
    }
    else {
        next();
    }
}

// Handlebar setup and custom helpers
app.engine('.hbs', exphbs.engine({
    extname: '.hbs',
    helpers: {
        navLink: function (url, options) {
            return '<li' +
                ((url == app.locals.activeRoute) ? ' class="active" ' : '') +
                '><a href="' + url + '">' + options.fn(this) + '</a></li>';
        },
        equal: function (lvalue, rvalue, options) {
            if (arguments.length < 3)
                throw new Error("Handlebars Helper equal needs 2 parameters");
            if (lvalue != rvalue) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        },
        safeHTML: function (context) {
            return stripJs(context);
        },
        formatDate: function (dateObj) {
            let year = dateObj.getFullYear();
            let month = (dateObj.getMonth() + 1).toString();
            let day = dateObj.getDate().toString();
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    }
}));
app.set('view engine', '.hbs');

// Cloudinary for image upload
cloudinary.config({
    cloud_name: "djbgvobqb",
    api_key: "252548656734628",
    api_secret: "5fOzoZ0qO1Ty8zr3RI8Eycl1EJU",
    secure: true,
  });

const upload = multer();

// View Path settings
var path = require('path');
var views = path.join(__dirname, 'views');

// Starting Server
blog_service.initialize()
    .then(authData.initialize)
    .then(function () {
        app.listen(process.env.PORT || 8080, () => {
            console.log("Server Started at port 8080");
        })
    }).catch(function (err) {
        console.log("unable to start server: " + err);
    });


app.use(express.static('public'));

// Set Active Route Style
app.use(function (req, res, next) {
    let route = req.path.substring(1);
    app.locals.activeRoute = (route == "/") ? "/" : "/" + route.replace(/\/(.*)/, "");
    app.locals.viewingCategory = req.query.category;
    next();
});

// Routes
app.get('/', (req, res) => {
    res.redirect('/blog');
});

app.get('/about', (req, res) => {
    res.render('about')
});

// Post Routes
app.get('/posts/add', ensureLogin, (req, res) => {
    blog_service.getCategories().then((data) => {
        res.render('addPost', {
            categories: data
        });
    }).catch((err) => {
        res.render('addPost', {
            categories: []
        });
    })
});

app.get('/posts', ensureLogin, (req, res) => {
    if (req.query.category) {
        blog_service.getPostsByCategory(req.query.category).then((data) => {
            if (data.length > 0) {
                res.render('posts', {
                    posts: data
                })
            } else {
                res.render('posts', { message: "No Results" });
            }
        }).catch((err) => {
            res.render("posts", { message: "No Results" });
        })
    } else if (req.query.minDate) {
        blog_service.getPostsByMinDate(req.query.minDate).then((data) => {
            if (data.length > 0) {
                res.render('posts', {
                    posts: data
                })
            } else {
                res.render('posts', { message: "No Results" });
            }
        }).catch((err) => {
            res.render("posts", { message: "No Results" });
        })
    } else {
        blog_service.getAllPosts().then((data) => {
            if (data.length > 0) {
                res.render('posts', {
                    posts: data
                })
            } else {
                res.render('posts', { message: "No Results" });
            }
        })
            .catch((err) => {
                res.render("posts", { message: "No Results" });
            })
    }
})

app.get('/posts/:id', ensureLogin, (req, res) => {
    blog_service.getPostsById(req.params.id).then((data) => {
        res.json(data)
    })
        .catch((err) => {
            res.json({
                message: "No Results"
            });
        })
})


app.post('/posts/add', ensureLogin, upload.single("featureImage"), (req, res) => {
    if (req.file) {
        let streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                let stream = cloudinary.uploader.upload_stream(
                    (error, result) => {
                        if (result) {
                            resolve(result);
                        } else {
                            reject(error);
                        }
                    }
                );
                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });
        };
        async function upload(req) {
            let result = await streamUpload(req);
            console.log(result);
            return result;
        }
        upload(req).then((uploaded) => {
            processPost(uploaded.url);
        });
    } else {
        processPost("");
    }

    function processPost(imageUrl) {
        req.body.featureImage = imageUrl;
        blog_service.addPost(req.body).then(() => {
            res.redirect('/posts');
        })
    }
})

app.get('/post/delete/:id', ensureLogin, (req, res) => {
    blog_service.deletePostById(req.params.id).then(() => {
        res.redirect('/posts');
    }).catch((err) => {
        res.status(500).render('posts', { message: "Unable to delete Post/ Post not Found" });
    })
});

// Blog Routes

app.get('/blog/:id', async (req, res) => {

    let viewData = {};

    try {

        let posts = [];

        if (req.query.category) {
            // Obtain the published "posts" by category
            posts = await blog_service.getPublishedPostsByCategory(req.query.category);
        } else {
            // Obtain the published "posts"
            posts = await blog_service.getPublishedPosts();
        }

        // sort the published posts by postDate
        posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));

        viewData.posts = posts;

    } catch (err) {
        viewData.message = "No Results";
    }

    try {
        let posts = [];
        // Obtain the post by "id"
        posts = await blog_service.getPostById(req.params.id);
        let post = posts[0];
        viewData.post = post;
    } catch (err) {
        viewData.message = "No Results";
    }


    try {
        // Obtain the full list of "categories"
        let categories = await blog_service.getCategories();

        viewData.categories = categories;
    } catch (err) {
        viewData.categoriesMessage = "No Results"
    }
    console.log(viewData);

    res.render("blog", { data: viewData })
});

app.get('/blog', async (req, res) => {

    // Declare an object to store properties for the view
    let viewData = {};

    try {
        let posts = [];
        if (req.query.category) {
            // Obtain the published "posts" by category
            posts = await blog_service.getPublishedPostsByCategory(req.query.category);
        } else {
            // Obtain the published "posts"
            posts = await blog_service.getPublishedPosts();
        }

        posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));

        let post = posts[0];

        viewData.posts = posts;
        viewData.post = post;

    } catch (err) {
        viewData.message = "No Results";
    }

    try {
        // Obtain the full list of "categories"
        let categories = await blog_service.getCategories();

        viewData.categories = categories;
    } catch (err) {
        viewData.categoriesMessage = "No Results"
    }

    res.render("blog", { data: viewData })

});

// Category Routes

app.get('/categories', ensureLogin, (req, res) => {
    blog_service.getCategories().then((data) => {
        if (data.length > 0) {
            res.render('categories', {
                categories: data
            })
        } else {
            res.render('categories', { message: "No Results" });
        }

    })
        .catch((err) => {
            res.render('categories', {
                message: "No Results"
            });
        })
})

app.get('/categories/add', ensureLogin, (req, res) => {
    res.render('addCategory');
});

app.post('/categories/add', ensureLogin, (req, res) => {
    console.log(req);
    blog_service.addCategory(req.body).then(() => {
        res.redirect('/categories');
    }).catch((err) => {
        res.render('categories', { message: 'Unable to add Category' });
    })
});

app.get('/categories/delete/:id', ensureLogin, (req, res) => {
    blog_service.deleteCategoryById(req.params.id).then(() => {
        res.redirect('/categories');
    }).catch((err) => {
        res.render('categories', { message: "Unable to delete Category" });
    })
});


// Login Route

app.get("/login", (req, res) => {
    res.render('login');
});

app.get("/register", (req, res) => {
    res.render('register');
});

app.post("/register", (req, res) => {
    authData.registerUser(req.body)
        .then(() => {
            res.render('register', { successMessage: "User Created" });
        })
        .catch((err) => {
            res.render('register', {
                errorMessage: err,
                userName: req.body.userName
            });
        })
});

app.post("/login", (req, res) => {
    req.body.userAgent = req.get('User-Agent');

    authData.checkUser(req.body).then((user) => {
        req.session.user = {
            "userName": user.userName,
            "email": user.email,
            "loginHistory": user.loginHistory
        }
        res.redirect('/posts');
    })
        .catch((err) => {
            res.render('login', {
                errorMessage: err,
                userName: req.body.userName
            });
        })
});

app.get('/logout', (req, res) => {
    req.session.reset();
    res.redirect('/login');
});

app.get('/userHistory', (req, res) => {
    res.render('userHistory');
})
// 404 page
app.use((req, res) => {
    res.status(404).render('404')
});