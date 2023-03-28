const artwork = {
  getCustomerArtWork: `Select count(*) as TotalCount from artwork Where customer_id=? AND customer_type_id = "3" AND status = "1"`,

  getCustomerAllArtWork: `SELECT a.id, a.artwork_name,a.artwork_url,a.thumbnail_url,a.artwork_type,a.artwork_colors,c.sh_customer_id,c.customer_name FROM artwork as a LEFT JOIN customers as c ON c.id = a.customer_id WHERE a.customer_id =? AND a.customer_type_id = "3" AND a.status = "1" `,

  getPublicArtWork: `Select count(*) as TotalCount from artwork Where customer_type_id= "1" AND status = "1"`,
  getPublicAllArtWork: `SELECT id, artwork_name,artwork_url,thumbnail_url,artwork_type,artwork_colors FROM artwork WHERE customer_type_id = "1" AND status = "1"`,

  searchCustomerArtWork: `SELECT id, artwork_name,artwork_url,thumbnail_url,artwork_type,artwork_colors FROM artwork WHERE customer_id =? AND customer_type_id = "3" AND status = "1"`,
  searchCustomerArtWorkCount: `SELECT count(*) as TotalCount FROM artwork WHERE customer_id =? AND customer_type_id = "3" AND status = "1" `,

  searchPublicArtWork: `SELECT id, artwork_name,artwork_url,thumbnail_url,artwork_type,artwork_colors FROM artwork WHERE customer_type_id = "1" AND status = "1"`,
  searchPublicArtWorkCount:
    'Select count(*) as TotalCount from artwork Where customer_type_id= "1" AND status = "1"',

  getArtworksByIds: `SELECT id, artwork_url, thumbnail_url, artwork_name FROM artwork WHERE id IN `,
  getArtworksById: `SELECT a.*, c.customer_name, c.sh_customer_id FROM artwork as a LEFT JOIN customers as c ON c.id = a.customer_id WHERE a.id =?`,

  getAdminArtWorkCount:
    'Select count(*) as TotalCount from artwork Where customer_type_id= "1" AND status = "1"',
  getAdminArtWork: `SELECT id, artwork_name,artwork_url,thumbnail_url,artwork_type,artwork_colors FROM artwork WHERE customer_type_id = "1" AND status = "1" ORDER BY created_at DESC LIMIT ? OFFSET ? `,

  getAllArtWorkCount: `Select count(*) as TotalCount from artwork Where status = "1"`,
  getAllArtWorkLagoCount: `Select count(*) as TotalCount from artwork Where customer_type_id = "1" AND status = "1"`,
  getAllArtWorkCustomerCount: `Select count(*) as TotalCount from artwork Where customer_id=? AND customer_type_id = "3" AND status = "1" `,

  getAllArtWork: `SELECT a.id, a.artwork_name,a.artwork_url,a.thumbnail_url,a.artwork_type,a.artwork_colors,c.sh_customer_id,c.customer_name FROM artwork as a
	LEFT JOIN customers as c ON c.id = a.customer_id  
	WHERE a.status = "1"`,
  getAllArtWorkLago: `SELECT a.id, a.artwork_name,a.artwork_url,a.artwork_type,a.thumbnail_url,a.artwork_colors,c.sh_customer_id,c.customer_name FROM artwork as a
	LEFT JOIN customers as c ON c.id = a.customer_id  
	WHERE c.customer_type_id = "1" AND a.status = "1"`,
  getAllArtWorkCustomer: `SELECT a.id, a.artwork_name,a.artwork_url,a.thumbnail_url,a.artwork_type,a.artwork_colors,c.sh_customer_id,c.customer_name FROM artwork as a
	LEFT JOIN customers as c ON c.id = a.customer_id
	WHERE a.customer_type_id = "3" AND a.status = "1"`,

  checkImageAssociationStatus: `SELECT * FROM image_association WHERE art_id =? AND status = "1"`,
};

const order = {
  customProduct: `SELECT custom_product_id FROM orders where sh_draft_order_id=? AND status = "1"`,
  getCustomizedProductsByOrder: `SELECT custom_product_id FROM orders where sh_draft_order_id=? AND status = "1"`,
  customProductRendering: `SELECT custom_product_front, custom_product_back, custom_product_sleeve, sh_product_id FROM custom_product_rendering as CPR WHERE CPR.status = "1"`,
  orderCommentDetails: `SELECT order_comments.id, orders.sh_draft_order_id as order_id, customers.sh_customer_id as sender, customer_type.type as sender_type, comment, receiver, receiver_type, order_comments.created_at FROM order_comments 
	JOIN orders ON order_comments.order_id = orders.id 
	LEFT JOIN customers ON order_comments.sender_id = customers.id 
	LEFT JOIN customer_type ON customers.customer_type_id = customer_type.id 
	LEFT JOIN (SELECT receiver_id, sh_customer_id as receiver, customer_type.type as receiver_type FROM order_comments 
			LEFT JOIN customers ON order_comments.receiver_id = customers.id 
			LEFT JOIN customer_type ON customers.customer_type_id = customer_type.id 
	WHERE customers.status = "1") REC ON order_comments.receiver_id = REC.receiver_id 
	WHERE orders.sh_draft_order_id =? AND order_comments.status = "1" 
	GROUP BY order_comments.id ORDER BY order_comments.id desc LIMIT 4 OFFSET 0`,
  orderId: `SELECT id FROM orders where sh_draft_order_id=? AND status = "1"`,
};

const customer = {
  checkCustomer: `SELECT * FROM customers JOIN customer_type ON customer_type.id = customers.customer_type_id where customers.sh_customer_id =? and customers.status = "1"`,
  selectCustomer: `SELECT id FROM customers WHERE sh_customer_id =? AND status = "1"`,
  getCustomerID: `SELECT id FROM customers WHERE sh_customer_id = ?`,
  getCustomerForCommet: `SELECT customers.id, customer_type_id, type FROM customers LEFT JOIN customer_type ON customers.customer_type_id = customer_type.id WHERE sh_customer_id=? AND customers.status = "1"`,
};
const comments = {
  getOrderComments: `SELECT order_comments.id, orders.sh_draft_order_id as order_id, customers.sh_customer_id as sender, customer_type.type as sender_type, comment, receiver, receiver_type, order_comments.created_at FROM order_comments 
	JOIN orders ON order_comments.order_id = orders.id LEFT JOIN customers ON order_comments.sender_id = customers.id LEFT JOIN customer_type ON customers.customer_type_id = customer_type.id 
	LEFT JOIN (SELECT receiver_id, sh_customer_id as receiver, customer_type.type as receiver_type FROM order_comments LEFT JOIN customers ON order_comments.receiver_id = customers.id 
		LEFT JOIN customer_type ON customers.customer_type_id = customer_type.id WHERE customers.status = "1") REC ON order_comments.receiver_id = REC.receiver_id WHERE orders.sh_draft_order_id =? AND order_comments.status = "1" 
		GROUP BY order_comments.id ORDER BY order_comments.id desc LIMIT 15`,
};

module.exports = {
  artwork,
  order,
  customer,
  comments,
};
