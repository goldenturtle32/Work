const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/jobs', (req, res) => {
  // Fetch jobs from database
  res.json([]);
});

app.get('/users/:id', (req, res) => {
  // Fetch user profile from database
  res.json({});
});

app.post('/jobs/apply', (req, res) => {
  const { jobId, userId } = req.body;
  // Handle job application logic
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
