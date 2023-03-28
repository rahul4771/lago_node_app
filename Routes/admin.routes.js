const express = require('express');
const checkAuth = require('../Middleware/checkAuth.middleware');
const authorizationControllers = require('../Controllers/authorization.controllers');
const draftOrdersControllers = require('../Controllers/draftOrders.controllers');
const customersControllers = require('../Controllers/customers.controllers');
const productControllers = require('../Controllers/product.controllers');
const artWorkControllers = require('../Controllers/artwork.controllers');
const salesRepsControllers = require('../Controllers/salesRep.controllers');
const router = express.Router();

/** draft order **/
router.get(
  '/purchase-orders',
  checkAuth,
  draftOrdersControllers.getDraftOrders,
);
router.get(
  '/purchase-orders/search',
  checkAuth,
  draftOrdersControllers.getDraftOrders,
);
router.get(
  '/purchase-orders/:id',
  checkAuth,
  draftOrdersControllers.getDraftOrderById,
);
router.get(
  '/order-previews/:id',
  checkAuth,
  draftOrdersControllers.getDraftOrderPreviewsById,
);
router.get(
  '/purchase-orders-by-customer',
  checkAuth,
  draftOrdersControllers.getDraftOrdersByCustomerId,
);
router.post(
  '/purchase-orders',
  checkAuth,
  draftOrdersControllers.createDraftOrder,
);
router.post(
  '/purchase-orders/:id',
  checkAuth,
  draftOrdersControllers.updateDraftOrder,
);
router.post(
  '/order-instructions',
  checkAuth,
  draftOrdersControllers.addOrderInstructions,
);
router.post(
  '/admin-approve-order',
  checkAuth,
  draftOrdersControllers.approveDraftOrder,
);
router.post(
  '/customer-approve-order',
  checkAuth,
  draftOrdersControllers.approveDraftOrder,
);
router.post(
  '/order-comments',
  checkAuth,
  draftOrdersControllers.addDraftOrderComments,
);
router.get(
  '/order-comments/:id',
  checkAuth,
  draftOrdersControllers.getDraftOrderComments,
);
/** customer **/
router.get('/customers', checkAuth, customersControllers.getCustomers);
router.post('/customers', checkAuth, customersControllers.addCustomers);
router.get(
  '/salesrep-customers',
  checkAuth,
  customersControllers.getSalesRepsCustomers,
);
router.get('/customers-all', checkAuth, customersControllers.getAllCustomers);
router.get('/customers/:id', checkAuth, customersControllers.getCustomerById);
router.get('/customers/details/:id', checkAuth, customersControllers.getCustomerDetailsById);
router.get('/customers/pending-orders/:id', checkAuth, customersControllers.getCustomerPendingOrders);
router.get('/customers/search', checkAuth, customersControllers.getCustomers);
router.get('/customer-list', checkAuth, customersControllers.getListCustomers);
/** customer Artwork **/
router.post(
  '/artwork/customer',
  checkAuth,
  artWorkControllers.postCustomerArtWork,
);
router.post(
  '/artwork/customer/:id',
  checkAuth,
  artWorkControllers.updateCustomerArtWork,
);
router.get(
  '/customer-artwork',
  checkAuth,
  artWorkControllers.getCustomerArtWork,
);
router.get('/artwork/:id', checkAuth, artWorkControllers.getArtworkById);
router.get('/public-artwork', checkAuth, artWorkControllers.getPublicArtWork);
router.get('/all-artwork', checkAuth, artWorkControllers.getAllArtWorks);
router.post('/image-encode', checkAuth, artWorkControllers.imageEncode);
router.post(
  '/artwork/remove-artwork',
  checkAuth,
  artWorkControllers.removeCustomerArtWork,
);
router.get('/admin-artwork', checkAuth, artWorkControllers.getAdminArtWork);
router.post('/artwork-upload', artWorkControllers.uploadArtwork);
/** product **/
router.get('/products', checkAuth, productControllers.getProducts);
router.get(
  '/products/:id',
  checkAuth,
  productControllers.getShopifyProductById,
);
router.get('/products-search', checkAuth, productControllers.getProducts);
router.get(
  '/products-types-and-vendors',
  checkAuth,
  productControllers.getProductTypeAndVendors,
);
/** sales reps **/
router.get('/sales-reps', checkAuth, salesRepsControllers.getSalesReps);
router.post('/add-sales-reps', checkAuth, salesRepsControllers.addSalesRep);
router.get('/sales-reps/:id', checkAuth, salesRepsControllers.getSalesRepById);
router.get(
  '/sales-reps-customers/:id',
  checkAuth,
  salesRepsControllers.getCustomersBySalesRepId,
);
router.get('/sales-reps/search', checkAuth, salesRepsControllers.getSalesReps);
router.post('/sales-reps/:id', checkAuth, salesRepsControllers.updateSaleRep);
router.post(
  '/sales-reps/remove-salesrep/:id',
  checkAuth,
  salesRepsControllers.removeSalesRepById,
);
/** send checkout url **/
router.post('/send-checkout-url', draftOrdersControllers.sendCheckOutUrlById);
/** customer login **/
router.post('/login', authorizationControllers.customerLogin);
router.post('/create-customer', authorizationControllers.createCustomer);

module.exports = router;
