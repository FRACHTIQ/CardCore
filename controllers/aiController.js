function status(req, res) {
  res.json({
    anthropic_configured: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}

module.exports = { status };
