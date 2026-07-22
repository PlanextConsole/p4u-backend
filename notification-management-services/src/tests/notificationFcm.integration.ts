import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../auth-management-services/.env') });
import { AppDataSource } from '../config/database';
import { NotificationService } from '../service/notification.service';
import { UserDevice } from '../entities/UserDevice';
import { UserNotification } from '../entities/UserNotification';

async function run(){
  await AppDataSource.initialize(); const svc=new NotificationService(); const userId=`fcm-integration-${Date.now()}`;
  try {
    await svc.registerDevice({userId,platform:'android',deviceToken:`invalid_integration_${'x'.repeat(180)}`});
    const result=await svc.send({userId,title:'Food order ready',body:'Integration delivery test',deepLink:'/app/food/orders/test',data:{type:'food_ready'}});
    if(!result.notification?.id || result.failed!==1) throw new Error(`FCM integration assertion failed: ${JSON.stringify({pushed:result.pushed,failed:result.failed})}`);
    const stored=await svc.getNotifications(userId); if(stored[0]?.metadata?.deepLink!=='/app/food/orders/test') throw new Error('Deep link was not persisted');
    console.log(JSON.stringify({result:'PASS',provider:'FCM',invalidTokenRejected:true,deepLinkPersisted:true}));
  } finally {
    await AppDataSource.getRepository(UserDevice).delete({userId});await AppDataSource.getRepository(UserNotification).delete({userId});await AppDataSource.destroy();
  }
}
run().catch(async e=>{console.error(e);if(AppDataSource.isInitialized)await AppDataSource.destroy();process.exit(1)});
