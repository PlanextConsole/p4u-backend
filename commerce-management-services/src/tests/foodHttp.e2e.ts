import axios from 'axios';
import { createHmac, randomUUID } from 'crypto';
import mysql from 'mysql2/promise';

const gateway='http://localhost:8080', keycloak='http://localhost:8180/realms/p4u-realm/protocol/openid-connect/token';
const password=process.env.HTTP_E2E_PASSWORD || '';
const users={customer:process.env.HTTP_CUSTOMER||'',vendor:process.env.HTTP_VENDOR||'',rider:process.env.HTTP_RIDER||'',admin:process.env.HTTP_ADMIN||''};
const ids={vendor:process.env.HTTP_VENDOR_ID||'',rider:process.env.HTTP_RIDER_ID||''};
function check(v:unknown,m:string):asserts v{if(!v)throw new Error(`HTTP E2E assertion failed: ${m}`)}
async function token(username:string,role:string){const body=new URLSearchParams({client_id:'auth-management-client',client_secret:process.env.HTTP_CLIENT_SECRET||'',username,password,grant_type:'password'});const {data}=await axios.post(keycloak,body,{headers:{'content-type':'application/x-www-form-urlencoded'}});const payload=JSON.parse(Buffer.from(data.access_token.split('.')[1],'base64url').toString());check(payload.realm_access?.roles?.includes(role),`${role} token contains role`);return data.access_token as string;}
const auth=(token:string)=>({headers:{Authorization:`Bearer ${token}`}});const unwrap=(r:any)=>r.data?.data??r.data;
async function run(){
  check(Object.values(users).every(Boolean)&&Object.values(ids).every(Boolean)&&password,'test identities configured');
  const db=await mysql.createConnection({host:'localhost',user:'root',password:'root@123',database:'p4u_food_test'});
  await db.query(`CREATE TABLE IF NOT EXISTS catalog_vendors (id varchar(36) PRIMARY KEY,business_name varchar(255) NOT NULL,keycloak_user_id varchar(128) NULL,commission_rate decimal(5,2) NULL,max_redemption_percent decimal(5,2) NULL,vendor_plan_id varchar(36) NULL,self_delivery boolean NOT NULL DEFAULT false,booking_availability_json json NULL,created_at timestamp DEFAULT CURRENT_TIMESTAMP,updated_at timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
  await db.query('UPDATE food_riders SET is_online=false');
  const vendorId=randomUUID();await db.query('INSERT INTO catalog_vendors(id,business_name,keycloak_user_id,commission_rate) VALUES(?,?,?,?)',[vendorId,'HTTP Kitchen',ids.vendor,10]);await db.end();
  const [customerToken,vendorToken,riderToken,adminToken]=await Promise.all([token(users.customer,'CUSTOMER'),token(users.vendor,'VENDOR'),token(users.rider,'RIDER'),token(users.admin,'ADMIN')]);
  const suffix=Date.now();
  const restaurant=unwrap(await axios.put(`${gateway}/api/v1/commerce/food/vendor/restaurant`,{name:`HTTP Kitchen ${suffix}`,address:'Gateway Road',latitude:12.9716,longitude:77.5946,status:'open',isActive:true,minOrderAmount:50,packagingFee:10},auth(vendorToken)));
  const category=unwrap(await axios.post(`${gateway}/api/v1/commerce/food/vendor/menu/categories`,{name:'Gateway meals'},auth(vendorToken)));
  const item=unwrap(await axios.post(`${gateway}/api/v1/commerce/food/vendor/menu/items`,{name:'Gateway thali',categoryId:category.id,price:180,inStock:true,isVeg:true,addons:[{id:'curd',name:'Curd',price:20}],customizations:[{id:'spice',name:'Spice',required:true,options:[{id:'mild',price:0},{id:'hot',price:10}]}]},auth(vendorToken)));
  const combo=unwrap(await axios.post(`${gateway}/api/v1/commerce/food/vendor/combos`,{name:'Gateway combo',itemIds:[item.id],price:150,inStock:true,isActive:true},auth(vendorToken)));
  const publicCombos=unwrap(await axios.get(`${gateway}/api/v1/commerce/food/restaurants/${restaurant.id}/combos`));check(publicCombos.some((x:any)=>x.id===combo.id),'combo visible through gateway');
  const rider=unwrap(await axios.post(`${gateway}/api/v1/commerce/food/admin/riders`,{userId:ids.rider,name:'HTTP Rider',phone:'9000012345',vehicleType:'bike',vehicleNumber:'KA-HTTP'},auth(adminToken)));
  await axios.patch(`${gateway}/api/v1/commerce/food/admin/riders/${rider.id}/approval`,{approved:true},auth(adminToken));
  await axios.patch(`${gateway}/api/v1/commerce/food/rider/online`,{online:true},auth(riderToken));await axios.post(`${gateway}/api/v1/commerce/food/rider/location`,{latitude:12.972,longitude:77.595},auth(riderToken));
  const cod=unwrap(await axios.post(`${gateway}/api/v1/commerce/food/orders`,{restaurantId:restaurant.id,items:[{comboId:combo.id,quantity:1}],deliveryAddress:'HTTP customer address',deliveryLat:12.975,deliveryLng:77.6,paymentMethod:'cod'},auth(customerToken)));check(cod.items[0].comboId===combo.id,'customer combo checkout through gateway');
  for(const status of ['accepted','preparing','ready'])await axios.patch(`${gateway}/api/v1/commerce/food/vendor/orders/${cod.id}/status`,{status},auth(vendorToken));
  await axios.post(`${gateway}/api/v1/commerce/food/vendor/orders/${cod.id}/assign-rider`,{},auth(vendorToken));const assignments=unwrap(await axios.get(`${gateway}/api/v1/commerce/food/rider/assignments`,auth(riderToken)));const assignment=assignments.find((x:any)=>x.order_id===cod.id);check(assignment,'rider assignment visible');
  await axios.post(`${gateway}/api/v1/commerce/food/rider/assignments/${assignment.id}/respond`,{accept:true},auth(riderToken));await axios.post(`${gateway}/api/v1/commerce/food/rider/assignments/${assignment.id}/pickup`,{},auth(riderToken));await axios.post(`${gateway}/api/v1/commerce/food/rider/assignments/${assignment.id}/deliver`,{otp:cod.handoverOtp},auth(riderToken));
  await axios.post(`${gateway}/api/v1/commerce/food/orders/${cod.id}/review`,{foodRating:5,deliveryRating:5,comment:'Gateway verified'},auth(customerToken));const pdf=await axios.get(`${gateway}/api/v1/commerce/food/orders/${cod.id}/invoice.pdf`,{...auth(customerToken),responseType:'arraybuffer'});check(Buffer.from(pdf.data).subarray(0,5).toString()==='%PDF-','PDF invoice through authenticated gateway');
  const online=unwrap(await axios.post(`${gateway}/api/v1/commerce/food/orders`,{restaurantId:restaurant.id,items:[{menuItemId:item.id,quantity:1,addonIds:['curd'],customizations:{spice:'hot'}}],deliveryAddress:'Online address',paymentMethod:'upi'},auth(customerToken)));
  const intent=unwrap(await axios.post(`${gateway}/api/v1/commerce/food/orders/${online.id}/payment`,{provider:'razorpay'},auth(customerToken)));
  const raw=JSON.stringify({event:'payment.captured',payload:{payment:{entity:{order_id:intent.providerOrderId,id:`pay_test_${suffix}`}}}});
  const signature=createHmac('sha256','razor-http-secret').update(raw).digest('hex');
  await axios.post(`${gateway}/api/v1/payments/webhooks/razorpay`,raw,{headers:{'content-type':'application/json','x-razorpay-signature':signature,'x-razorpay-event-id':`evt-${suffix}`}});
  const replay=unwrap(await axios.post(`${gateway}/api/v1/payments/webhooks/razorpay`,raw,{headers:{'content-type':'application/json','x-razorpay-signature':signature,'x-razorpay-event-id':`evt-replay-${suffix}`}}));
  check(replay.duplicate===true,'semantic payment webhook replay rejected with a different event id');
  const failedRaw=JSON.stringify({event:'payment.failed',payload:{payment:{entity:{order_id:intent.providerOrderId,id:`pay_test_${suffix}`}}}});
  const failedSignature=createHmac('sha256','razor-http-secret').update(failedRaw).digest('hex');
  const lateFailure=unwrap(await axios.post(`${gateway}/api/v1/payments/webhooks/razorpay`,failedRaw,{headers:{'content-type':'application/json','x-razorpay-signature':failedSignature,'x-razorpay-event-id':`evt-failed-${suffix}`}}));
  check(lateFailure.ignored==='captured_payment_cannot_fail','late failed webhook cannot downgrade captured payment');
  const paid=unwrap(await axios.get(`${gateway}/api/v1/commerce/food/orders/${online.id}`,auth(customerToken)));check(paid.paymentStatus==='paid','online webhook reached commerce through signed callback');await axios.post(`${gateway}/api/v1/commerce/food/orders/${online.id}/cancel`,{reason:'HTTP refund'},auth(customerToken));const refund=unwrap(await axios.post(`${gateway}/api/v1/commerce/food/admin/orders/${online.id}/refunds`,{reason:'HTTP provider refund'},auth(adminToken)));const completed=unwrap(await axios.patch(`${gateway}/api/v1/commerce/food/admin/refunds/${refund.id}`,{success:true},auth(adminToken)));check(completed.status==='completed','provider-side test refund completed through gateway');
  const settlements=unwrap(await axios.get(`${gateway}/api/v1/commerce/food/admin/rider-settlements`,auth(adminToken)));check(settlements.some((x:any)=>x.assignment_id===assignment.id),'admin sees rider settlement');
  console.log(JSON.stringify({result:'PASS',restaurantId:restaurant.id,codOrderId:cod.id,onlineOrderId:online.id,refundId:refund.id,roles:['CUSTOMER','VENDOR','RIDER','ADMIN']}));
}
run().catch(e=>{console.error(e.response?.data||e);process.exit(1)});
