const express = require('express');
const server = express();
const fs = require('fs');
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const mongoClient = require('mongodb').MongoClient;
const session = require("express-session");
const { Console } = require('console');
const exphbs = require('express-handlebars');
const { get } = require('http');

server.use(cookieParser());
server.use(session({secret:"something"}))
const port = 5000;
var sess;
var cart = []

//Handlebars
server.engine('hbs', exphbs({
    defaultLayout: 'main',
    extname: '.hbs'
}));
server.set('view engine', 'hbs');

//Database managment
const url = "mongodb://localhost:27017/web_data"
mongoClient.connect(url, function(err,db) {
    if (err) {
        throw err
    }
    console.log("Connection established")
    db.close()
});

//Local functions
function searchItem(number,items){ //Function to search for a JSon item on an array
    for (let i = 0; i < items.length; i++) {
        if (items[i].id == number){
            return items[i];
        }
    }
}

function searchItemByid(id, list){
    for (let i = 0; i < list.length; i++) {
        if (list[i].id==id) {
            return list[i]
        }
    }
    return null
}

//Server functions
server.use(express.static("static"));

server.use(express.urlencoded({
    extended: true
}))

server.listen(port, () => {
    console.log(`Server listening at ${port}`);
});

server.get("/welcome", (req, res) => { //Response for the request ip/
    sess=req.session
    if (sess.un) {
        res.render('home',{name:sess.un,logged:true}) 
    }else{
        res.render('home',{name:'¡Not logged in!',logged:false}) 
    }
});    

server.get("/add2basket", (req, res) => { //Manages the action of adding an item to a basket
    sess=req.session
    var itemName = req.query.name
    cart.push(itemName)
    sess.cart = cart
    console.log(sess.cart)
    res.redirect(req.get('referer')); //Redirects me to the current item
});   

server.get("/cart", (req, res) => { //Renders the cart
    sess=req.session
    if (sess.un) { //un = user name
        res.render('cart',{name:sess.un,logged:true,cart:sess.cart}) 
    }else{
        res.render('cart',{name:'¡Not logged in!',logged:false,cart:sess.cart}) 
    }
});  

server.get("/buy", (req, res) => { //This is to managge the action of buying the shopping cart
    sess=req.session
    for (let i = 0; i < sess.cart.length; i++) { //Iterate the cart to update the database
        fondNupdate({"name":sess.cart[i]},{$inc:{"stock":-1}})
    }
    sess.cart = []
    res.redirect('/welcome');

    async function fondNupdate(json1,json2){ //Async function to update one value on a db
        const client = new mongoClient(url);
        await client.connect();
        const col = client.db("web_data").collection('homework1_products');
        const result = await col.updateOne(json1, json2);
    }

});  

server.get("/ongoing-session", (req, res) => { //This is to see if there is a session going on
    sess = req.session
    if (sess.un) {
        res.send("There is a session going on")
    }else{
        res.send("There is no session going on")
    }
});    

server.get('/logout',(req,res) => {
    req.session.destroy((err) => {
        if(err) {
            return console.log(err);
        }
        res.redirect('/form');
    });

});

server.get("/form",(req,res)=>{ //To render the form page for the log in
    sess=req.session
    if (sess.un) {
        res.render('form',{name:sess.un,logged:true})
    }else{
        res.render('form',{name:'¡Not logged in!',logged:false}) 
    }
});

server.get("/register",(req,res)=>{ //To render the register page
    sess=req.session
    if (sess.un) {
        res.render('register',{name:sess.un,logged:true})
    }else{
        res.render('register',{name:'¡Not logged in!',logged:false}) 
    }
});

server.get("/products",(req,res)=>{ //To render the products page
    sess=req.session
    var documentData = "<!DOCTYPE html><html><head><title>Products</title></head><body><ul>" 

    mongoClient.connect(url, function(err,mongodb) {
        if (err) {
            throw err
        }
        mongodb.db('web_data').collection('homework1_products').find({}).toArray(
            function(err, result) {
                if (err) {
                    throw err
                }
                if (sess.un) {
                    res.render('products',{name:sess.un,logged:true,products:result})
                }else{
                    res.render('products',{name:'¡Not logged in!',logged:false,products:result}) 
                }
        });
    });

});

server.get("/product",(req,res)=>{ //To render the single product page
    var name = req.query.name
    sess=req.session
    mongoClient.connect(url, function(err,mongodb) {
        if (err) {
            throw err
        }
        mongodb.db('web_data').collection('homework1_products').findOne({"name":name},
            function(err, item) {
                if(err){
                    throw err;
                }
                if(item){
                    if (sess.un) {
                        res.render('product',{name:sess.un,logged:true,item:item})
                    }else{
                        res.render('product',{name:'¡Not logged in!',logged:false,item:item})
                    }
                }
        });
    });
});

server.get("/item", (req, res) =>{ //To handle request and the answer for an item
    let itemId = req.query.id;
    let item = searchItem(itemId,itemList)
    res.setHeader('Content-Type', 'text/html');
    res.write(JSON.stringify(item));
    res.end();
}); 

server.post("/register",(req,res)=>{ //To handle the post petitions on register
    firstname = req.body.name;
    pass = req.body.pass;

    mongoClient.connect(url, function(err,mongodb) {
        if (err) {
            throw err
        }
        mongodb.db('web_data').collection('homework1_users').findOne({name:firstname},
            function(err, user) {
                if(err){
                    throw err;
                }
                if(user){
                    console.log("Tht user with the name "+user.name+" already exists")
                    res.redirect('/register')
                    mongodb.close()
                }else{
                    mongodb.db('web_data').collection('homework1_users').insertOne({name:firstname, password:pass}, 
                        function(err, user) {
                            if(err){
                                throw err;
                            }
                            res.redirect('/form')
                    });
                }
        });
    });
});

server.post("/form", async function(req,res){ //To handle the post petitions on log in form
    firstname = req.body.name;
    pass = req.body.pass;
    sess = req.session
    mongoClient.connect(url, function(err,mongodb) {
        if (err) {
            throw err
        }
        mongodb.db('web_data').collection('homework1_users').findOne({name:firstname, password:pass}, 
            function(err, user) {
                if(err){
                    throw err;
                }
                if(user){
                    sess.un = user.name //I give a property to the session to start it
                    console.log("Tht user "+user.name+" is in the database")
                    res.redirect('/products')
                    mongodb.close()
                }else{
                    console.log("No matching user found")
                    res.redirect('/form')
                }
            });
    });

});



