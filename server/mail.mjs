/**
 * Outgoing mail through a provider's HTTP API (Brevo or Resend), no SMTP and no packages.
 * Off unless BIRD_MAIL_TRANSPORT names a provider and its key and sender are set. A failed send is logged and
 * reported as false; it never throws, so a broken provider cannot break the request that wanted to send.
 */
const SENDERS={
 brevo:(c,m)=>fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',signal:AbortSignal.timeout(10000),headers:{'api-key':c.mailKey,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({sender:{email:c.mailFrom,...(c.mailFromName?{name:c.mailFromName}:{})},to:[{email:m.to}],subject:m.subject,textContent:m.text,...(m.html?{htmlContent:m.html}:{})})}),
 resend:(c,m)=>fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{authorization:'Bearer '+c.mailKey,'content-type':'application/json'},body:JSON.stringify({from:c.mailFromName?`${c.mailFromName.replace(/[<>"]/g,'')} <${c.mailFrom}>`:c.mailFrom,to:[m.to],subject:m.subject,text:m.text,...(m.html?{html:m.html}:{})})}),
};

/** Tests capture mail with config.testTransport: an array collects the letters, a function receives them. */
export const mailEnabled=config=>Boolean(config.testTransport||(SENDERS[config.mailer]&&config.mailKey&&config.mailFrom));

export async function sendMail(config,{to,subject,text,html}){
 if(!to||!mailEnabled(config))return false;
 const letter={to,subject,text,html};
 // Synchronous until here, so a caller that does not await still has the test letter in hand.
 if(config.testTransport){try{Array.isArray(config.testTransport)?config.testTransport.push(letter):config.testTransport(letter);return true;}catch{return false;}}
 try{
  const res=await SENDERS[config.mailer](config,letter);
  if(res.ok)return true;
  console.error('Mail not sent:',config.mailer,res.status,(await res.text().catch(()=>'')).slice(0,200));
 }catch(e){console.error('Mail not sent:',config.mailer,e?.name||'Error',String(e?.message||'').slice(0,200));}
 return false;
}
