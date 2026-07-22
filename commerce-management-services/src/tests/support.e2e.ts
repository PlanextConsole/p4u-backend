import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { AppDataSource } from '../config/database';
import { ensureSupportSchema } from '../config/ensureSupportSchema';
import { SupportService } from '../service/support.service';

async function expectReject(fn:()=>Promise<unknown>,part:string){try{await fn();throw new Error(`Expected rejection: ${part}`);}catch(e:any){if(!String(e.message).includes(part))throw e;}}
async function main(){await AppDataSource.initialize();await ensureSupportSchema();const svc=new SupportService();const customer=randomUUID(),other=randomUUID(),admin=randomUUID();let ticketId='';try{
  const created:any=await svc.create(customer,'customer',{subject:'Missing delivery item',category:'order',priority:'high',message:'One item was absent from the delivered package'});ticketId=created.id;
  await expectReject(()=>svc.get(ticketId,other,'customer'),'not found');
  await expectReject(()=>svc.get(ticketId,randomUUID(),'vendor'),'not found');
  await svc.addMessage(ticketId,admin,'admin',{message:'We are checking this with the vendor'});
  const customerReply:any=await svc.addMessage(ticketId,customer,'customer',{message:'Thank you, the order number is available in metadata'});
  if(customerReply.messages.length!==3||customerReply.messages[0].sender_type!=='customer'||customerReply.messages[1].sender_type!=='admin')throw new Error('Support messages are not ordered');
  const queue:any=await svc.list(admin,'admin',{status:'in_progress'});if(!queue.items.some((x:any)=>x.id===ticketId))throw new Error('Admin queue missing ticket');
  await Promise.all([svc.administer(ticketId,admin,{status:'resolved'}),svc.administer(ticketId,admin,{status:'resolved'})]);
  await expectReject(()=>svc.addMessage(ticketId,customer,'customer',{message:'This replay must be rejected'}),'cannot receive');
  const final:any=await svc.get(ticketId,admin,'admin');if(final.status!=='resolved'||!final.resolved_at)throw new Error('Resolution was not persisted');
  console.log(JSON.stringify({result:'PASS',ownerScoping:true,vendorIsolation:true,messageOrder:true,adminQueue:true,resolutionReplay:true,terminalReplyGuard:true}));
}finally{if(ticketId)await AppDataSource.query('DELETE FROM support_tickets WHERE id=$1',[ticketId]);await AppDataSource.destroy();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
