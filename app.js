require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const { auth, adminAuth } = require(__dirname + '/auth.js');

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.DATABASE_URL, {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set("useCreateIndex", true);

const productSchema = {
  title: String,
  price: Number,
  des: String
}

const Product = mongoose.model("Product", productSchema);

const orderSchema = {
  userID: String,
  totalCartValue: Number,
  checkoutProducts: [Object]
};

const Order = mongoose.model("Order", orderSchema);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  role: String,
  userDetails: Object
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});


app.get("/", cartIndex, (req, res) => {
  res.render("home", {logedIn: req.isLogedIn, cartIndex: req.cartIndex});
});

app.get("/products", cartIndex, (req, res) => {
  Product.find({}, (err, foundProducts) => {
      res.render("products", {products: foundProducts, logedIn: req.isLogedIn, cartIndex: req.cartIndex});
  });
});

app.get("/addProduct", auth, adminAuth, cartIndex,  (req, res) => {
  res.render("addProduct", {logedIn: req.isLogedIn, cartIndex: req.cartIndex});
});

app.get("/orders", auth, adminAuth, cartIndex,  (req, res) => {
  Order.find((err, foundOrders) => {
    res.render("orders", {userOrder: false, logedIn: req.isLogedIn, cartIndex: req.cartIndex, orders: foundOrders});
  });
});

app.post("/addproduct",isUserAdmin, (req, res) => {

  let newProduct = new Product({
    title: req.body.productTitle,
    price: req.body.productPrice,
    des: req.body.productDes
  });
  newProduct.save();

  res.redirect("/");
});

app.get("/cart", auth, cartIndex, userFound, (req, res) => {
  res.render("cart", {logedIn: req.isLogedIn, cartIndex: req.cartIndex, user: req.foundUser});
});

app.post("/addtocart", auth, userFound, (req, res) => {

  Product.findById(req.body.productID, (err, foundProduct) => {
    if(err){
      console.log(err);
    }else{

      const foundUser = req.foundUser;

      foundUser.userDetails.cartProducts.push(foundProduct);

        newUserDetails = {
          cartIndex: foundUser.userDetails.cartIndex+1,
          cartProducts: foundUser.userDetails.cartProducts
        };

        foundUser.userDetails = newUserDetails;

        foundUser.save((err) => {
          if(err){
            console.log(err);
          }else{
            res.redirect("/products");
          }
        });
    }
  });
});

app.post("/removefromcart", userFound, (req, res) => {

  const foundUser = req.foundUser;

  const cartProducts = foundUser.userDetails.cartProducts;

  let i = 0;
  for(let product of cartProducts){
    if(product._id == req.body.productID){
        cartProducts.splice(i, 1);
        break;
    }

    i++;
  }

  newUserDetails = {
    cartIndex: foundUser.userDetails.cartIndex-1,
    cartProducts: cartProducts
  };

  foundUser.userDetails = newUserDetails;

  foundUser.save();
  res.redirect("/cart");

});

app.post("/checkout", userFound, (req, res) => {
  const foundUser = req.foundUser;

  const totalCartValue = req.body.totalCartValue;

  if(totalCartValue == 0){
    res.redirect("/cart");
  }else{

    const newOrder = new Order({
      userID: req.user.id,
      totalCartValue: totalCartValue,
      checkoutProducts: req.user.userDetails.cartProducts
    });

    newOrder.save((err) => {
      if(err){
        console.log(err);
      }else{

        newUserDetails = {
          cartIndex: 0,
          cartProducts: []
        };

        foundUser.userDetails = newUserDetails;
        foundUser.save();
        res.redirect("/yourorders");
      }
    });
  }
});

app.get("/yourorders", auth,cartIndex, userFound, (req, res) => {
  const foundUser = req.foundUser;

  Order.find({userID: foundUser._id}, (err, foundOrders) => {
    res.render("orders", {userOrder: true, logedIn: req.isLogedIn, cartIndex: req.cartIndex, orders: foundOrders});
  });
});

app.get("/admin", auth,  (req, res) => {
      console.log(req.user);
      User.findById(req.user.id, (err, foundUser) => {
        foundUser.role = "Admin";
        foundUser.save((err) => {
          if(!err){
            res.send("Admin made Succesfully");
          }else{
            res.send(err);
          }
        });
      });
});

// Login Route
app.route("/login")
  .get(cartIndex, (req, res) => {
    res.render("login", {logedIn: req.isLogedIn, cartIndex: req.cartIndex});
  })
  .post((req, res) => {
    const user = new User({
      username: req.body.username,
      password: req.body.password
    });

    req.login(user, (err) => {
      if(err){
        console.log(err);
      }else{
        passport.authenticate("local")(req, res, () => {
            res.redirect("/");
        });
      }
    });
  });

app.get("/logout", (req, res) => {
  req.logOut();
  res.redirect("/");
})

// Register Route
app.route("/register")
  .get(cartIndex, (req, res) => {
    res.render("register", {logedIn: req.isLogedIn, cartIndex: req.cartIndex});
  })
  .post((req, res) => {
    User.register({username: req.body.username}, req.body.password, (err, user) => {
      if(err){
        console.log(err);
        res.redirect("/register");
      }else{
        passport.authenticate("local")(req, res, () => {
          User.findById(req.user.id, (err, foundUser) => {
            let currUserDetail = {
              cartIndex: 0,
              cartProducts: []
            };

            foundUser.role = "Customer",

            foundUser.userDetails = currUserDetail;
            foundUser.save();

            res.redirect("/");
          });
        });
      }
    });
  });

async function cartIndex(req, res, next){
  if(req.isAuthenticated()){
    await User.findById(req.user.id, (err, foundUser) => {
      req.cartIndex = foundUser.userDetails.cartIndex;
    });
    req.isLogedIn = true;
  }else{
    req.isLogedIn = false;
  }
  next();
}

async function userFound(req, res, next){
  await User.findById(req.user.id, (err, foundUser) => {
    if(!err){
      req.foundUser = foundUser;
    }else{
      res.send("User not found");
    }
    next();
  });
}

async function isUserAdmin(req, res, next){
  await User.findById(req.user.id, (err, foundUser) => {
    if(foundUser.role == "Admin"){
      next();
    }else{
      res.send("Only admin can add product");
    }
  });
}

app.listen(process.env.PORT || 3000, () => {
  console.log("Server is running");
});
