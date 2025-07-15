const mongoose = require('mongoose');

const homeContentSchema = new mongoose.Schema({
  description: String,
  backgroundImage: String,
  welcomeText: String,
  newsdes: String,
  newsdestitle: String,
  latestdes: String,
  imagenews: String,
});

const HomeContent = mongoose.model('HomeContent', homeContentSchema, 'homecontents');  // Explicitly define the collection

module.exports = HomeContent;