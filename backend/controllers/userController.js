const getUsers = (req, res) => {
  res.json([{ name: "Alice" }, { name: "Bob" }]);
};

module.exports = { getUsers };
