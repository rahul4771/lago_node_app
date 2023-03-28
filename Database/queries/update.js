const artwork = {
  updateCustomerArtWork: `UPDATE artwork SET artwork_name=? ,customer_id=?, customer_type_id=?, artwork_type=? ,artwork_colors=? where id=?`,
  deleteCustomerArtWork: `UPDATE  artwork SET status ="0", updated_at =? WHERE id =?`,
};

const order = {
  customProduct: `UPDATE orders SET custom_product_id=? WHERE sh_draft_order_id=? AND status = "1"`,
  customProductSql: `UPDATE custom_product_rendering SET status="0" WHERE id IN (?) AND status = "1";`,
  imgAssocSql: `UPDATE image_association SET status="0" WHERE custom_product_id IN (?) AND status = "1";`,
};

module.exports = {
  artwork,
  order,
};
