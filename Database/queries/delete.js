const artwork = {
  deleteFiles: `DELETE FROM artwork WHERE id IN (?, ?)`,
};

module.exports = {
  artwork,
};
