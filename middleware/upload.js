const multer = require("multer");
const upload = multer({ dest: "uploads/" }); // temporarily save files
module.exports = upload;
