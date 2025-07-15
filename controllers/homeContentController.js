// homeContentController.js
const HomeContent = require('../models/homeContent'); // Your model

exports.getHomeContent = (req, res) => {
  // Fetch data from MongoDB
  HomeContent.findOne() // Fetching the first document
    .then((homeContent) => {
      // Check if homeContent is found
      if (homeContent) {
        // Pass the data to the view
        res.render('homecontent', {
          homeContent: homeContent // Ensure the variable is passed correctly
        });
      } else {
        // If no content found, render a message or default content
        res.render('homecontent', { homeContent: { description: 'No content available' } });
      }
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send('Server Error');
    });
};

