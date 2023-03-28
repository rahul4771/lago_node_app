const artwork = {
  insertCustomerArtWork: `INSERT INTO artwork (artwork_url,thumbnail_url,artwork_name,customer_id,customer_type_id,status,created_at,artwork_type,artwork_colors) VALUES (?,?,?,?,?,?,?,?,?)`,
};

const order = {
  insertOrder: `INSERT INTO orders (sh_draft_order_id, custom_product_id, created_at) VALUES (?,?,?)`,
  insertOrderComment:
    'INSERT INTO order_comments (order_id, sender_id, sender_type_id, comment, receiver_id, receiver_type_id, created_at) VALUES (?,?,?,?,?,?,?)',
};

const customer = {
  insertCustomer: `INSERT INTO customers (sh_customer_id,customer_name,customer_type_id,created_at) VALUES (?,?,?,?)`,
};

const customProductRendering = {
  insertCustomProductRender: `INSERT INTO custom_product_rendering (customer_id, custom_product_front, custom_product_back, custom_product_sleeve, sh_product_id, sh_variants, created_at) VALUES (?,?,?,?,?,?,?)`,
  insertImageAssociation:
    'INSERT INTO image_association (art_id, custom_product_id, created_at) VALUES (?,?,?)',
};

module.exports = {
  artwork,
  order,
  customer,
  customProductRendering,
};
