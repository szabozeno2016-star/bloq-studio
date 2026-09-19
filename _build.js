const fs=require("fs");
let h=fs.readFileSync("bloq-studio.html","utf8");
[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m,i)=>{try{new Function(m[1]);}catch(e){console.log("inline "+i+" ERR "+e.message);}});
h=h.replace('<script src="bloq-ui.js"></script>',()=>"<script>\n"+fs.readFileSync("bloq-ui.js","utf8")+"\n</script>");
h=h.replace('<script src="bloq-builds.js"></script>',()=>"<script>\n"+fs.readFileSync("bloq-builds.js","utf8")+"\n</script>");
fs.writeFileSync("bloq-standalone.html",h);
const nb=(fs.readFileSync("bloq-builds.js","utf8").match(/\bid:'/g)||[]).length;
console.log("rebuilt ok",h.length,"builds:",nb);
