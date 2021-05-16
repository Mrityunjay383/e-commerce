function auth(req, res, next){
  if(req.isAuthenticated()){
    next();
  }else{
    res.redirect("/login");
  }
}

function adminAuth(req, res, next){
  if(req.user.role === "Admin"){
    next();
  }else{
    res.send("You have to be admin to asses this page");
  }
}



module.exports = {auth, adminAuth};
