import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const db=process.env.PHOTO_SCRATCH_DB??'travelmate_scratch_20261017e',base='http://127.0.0.1:5175';
if(!/^travelmate_scratch_\d{8}[a-z]$/.test(db))throw Error('Scratch name required');
const output=`${root}/docs/freeze-plan/photo-audit-20261017/browser`;
mkdirSync(output,{recursive:true});
for(const line of readFileSync(process.env.PHOTO_ENVIRONMENT_FILE??'C:/FYP/travelmate/backend/.env','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);if(m)process.env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
const url=new URL(process.env.DATABASE_URL);
if(url.pathname!='/travelmate'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Unexpected source connection');
Object.assign(process.env,{PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password)});
const sql=query=>execFileSync('psql',['-X','-A','-t','-F','|','-v','ON_ERROR_STOP=1','-d','postgres','-c',query],{encoding:'utf8'}).trim();
const run=(command,args)=>execFileSync(command,args,{env:process.env,stdio:['ignore','pipe','pipe'],encoding:'utf8'});
const result={database:db,created:false,dropped:false,checks:[],screenshots:[],error:null,externalRequestsBlocked:0,uncreditedRequests:0};
const save=()=>writeFileSync(`${output}/checks.json`,JSON.stringify(result,null,2)+'\n');
let server,browser,prisma;
try{
 if(sql(`SELECT count(*) FROM pg_database WHERE datname='${db}'`)!=='0')throw Error('Scratch database already exists');
 const dump=process.env.PHOTO_V6_SNAPSHOT??'C:/FYP/travelmate-private-backups/2026-10-06-demo/travelmate_demo_20261016_seeded_v6.dump';
 if(createHash('sha256').update(readFileSync(dump)).digest('hex').toUpperCase()!=='D84F90858E142741F0DC5B5F68D77BEDD16D4971F658778E5365F0DCD4826D34')throw Error('v6 checksum mismatch');
 run('createdb',['--maintenance-db=postgres',db]);result.created=true;save();
 run('pg_restore',['--single-transaction','--exit-on-error','--no-owner','--no-privileges','-d',db,dump]);
 url.pathname=`/${db}`;
 Object.assign(process.env,{DATABASE_URL:url.toString(),PORT:'5175',CORS_ORIGIN:base,PYTHON_EXECUTABLE:'C:/FYP/travelmate/backend/.venv/Scripts/python.exe'});
 const {app}=await import(pathToFileURL(`${root}/backend/dist/app.js`).href);
 ({prisma}=await import(pathToFileURL(`${root}/backend/dist/lib/prisma.js`).href));
 const baseline=await prisma.$queryRawUnsafe(`SELECT (SELECT count(*)::int FROM users) AS users,(SELECT count(*)::int FROM user_preferences) AS preferences,(SELECT count(*)::int FROM destinations) AS destinations,(SELECT count(*)::int FROM places WHERE "deletedAt" IS NULL AND lower(btrim(category))<>'test') AS discoverable,(SELECT count(*)::int FROM places WHERE "deletedAt" IS NOT NULL) AS archived,(SELECT count(*)::int FROM itineraries) AS itineraries,(SELECT count(*)::int FROM itinerary_items) AS items,(SELECT count(*)::int FROM saved_places) AS saved`);
 result.baseline=Object.values(baseline[0]).join('|');if(result.baseline!=='2|1|6|56|0|1|3|0')throw Error('Unexpected restored baseline');
 const {default:express}=await import(pathToFileURL(`${root}/backend/node_modules/express/index.js`).href);
 const fixture=express();fixture.use((req,res,next)=>req.path.startsWith('/api/')?app(req,res,next):next());fixture.use(express.static(`${root}/dist`));fixture.use((req,res)=>res.sendFile(`${root}/dist/index.html`));
 server=await new Promise((resolve,reject)=>{const s=fixture.listen(5175,'127.0.0.1',()=>resolve(s));s.once('error',reject)});
 const json=async(path,method='GET',body,token)=>{const response=await fetch(`${base}/api${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});if(!response.ok)throw Error(`Scratch API ${path} HTTP ${response.status}`);return(await response.json()).data;};
 const places=(await json('/places?limit=100')).items;
 const missing=places.filter(place=>!place.imageUrl);
 const broken=places.find(place=>place.name==='Petronas Twin Towers');
 const restaurant=missing.find(place=>place.category==='Restaurant');
 const hotel=missing.find(place=>place.category==='Accommodation');
 await prisma.place.update({where:{id:hotel.id},data:{imageUrl:'/images/places/uncredited.jpg'}});
 const password=randomBytes(24).toString('base64url')+'Aa1!';
 const auth=await json('/auth/register','POST',{name:'Scratch Photo Check',email:`photo-${randomBytes(8).toString('hex')}@travelmate.test`,password});
 await json('/saved-places','POST',{placeId:restaurant.id},auth.token);
 await json('/saved-places','POST',{placeId:broken.id},auth.token);
 const itinerary=await json('/itineraries','POST',{title:'Scratch category photo verification',startDate:'2026-10-18',endDate:'2026-10-19',destinationId:restaurant.destinationId},auth.token);
 await json(`/itineraries/${itinerary.id}/items`,'POST',{placeId:restaurant.id,day:1,timeSlot:'Morning'},auth.token);
 await json(`/itineraries/${itinerary.id}/items`,'POST',{placeId:broken.id,day:2,timeSlot:'Afternoon'},auth.token);
 const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.addInitScript(({token,user})=>{localStorage.setItem('travelmate_access_token',token);localStorage.setItem('travelmate_auth_user',JSON.stringify(user));},{token:auth.token,user:auth.user});
 await context.route('**/*',route=>{const requestUrl=new URL(route.request().url());if(requestUrl.origin!==base){result.externalRequestsBlocked++;return route.abort();}if(requestUrl.pathname==='/images/places/uncredited.jpg'){result.uncreditedRequests++;return route.abort();}if(requestUrl.pathname===broken.imageUrl)return route.abort();if(requestUrl.pathname.endsWith('/weather'))return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,error:{code:'PHOTO_FIXTURE_NO_WEATHER',message:'Weather disabled for offline photo verification.'}})});return route.continue();});
 const page=await context.newPage();
 const screen=async name=>{await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`${output}/${name}.png`,fullPage:true});result.screenshots.push(`${name}.png`);save();};
 const checkPage=async label=>{await page.waitForTimeout(300);const check=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,brokenPhotos:[...document.images].filter(image=>!image.closest('.leaflet-container')&&image.complete&&image.naturalWidth===0).length,blockedMapTiles:[...document.images].filter(image=>image.closest('.leaflet-container')&&image.complete&&image.naturalWidth===0).length}));result.checks.push({label,...check,ok:!check.overflow&&!check.brokenPhotos});save();if(check.overflow||check.brokenPhotos){await page.screenshot({path:`${output}/failure.png`,fullPage:true});throw Error(`Photo layout failed: ${label}`);}};
 for(const category of ['Accommodation','Restaurant','Attraction','Culture','Historical','Nature','Shopping']){
  const place=missing.find(place=>place.category===category);
  await page.goto(`${base}/destinations/${place.destinationId}/places/${place.id}`);
  const placeholder=page.getByRole('img',{name:`${place.name}: ${place.category} placeholder, no photo`,exact:true});
  await placeholder.waitFor();await checkPage(`detail-${category}`);
  await placeholder.screenshot({path:`${output}/category-${category.toLowerCase()}.png`});result.screenshots.push(`category-${category.toLowerCase()}.png`);
 }
 const hotelDestination=await json(`/destinations/${hotel.destinationId}`);
 await page.goto(`${base}/destinations/${hotel.destinationId}`);await page.getByRole('heading',{name:`Explore ${hotelDestination.name}`,exact:true}).waitFor();await checkPage('explore-category-cards');await screen('explore-desktop');
 await page.goto(`${base}/saved-trips`);await page.getByRole('heading',{name:'Your place shortlist'}).waitFor();await page.getByRole('img',{name:`${broken.name}: ${broken.category} placeholder, no photo`,exact:true}).waitFor();await checkPage('saved-image-error');await screen('saved-desktop');
 await page.goto(`${base}/itinerary`);await page.getByRole('heading',{name:'Plan your next trip',exact:true}).waitFor();await page.getByRole('img',{name:`${restaurant.name}: ${restaurant.category} placeholder, no photo`,exact:true}).waitFor();await checkPage('itinerary-category-fallback');await screen('itinerary-desktop');
 await page.setViewportSize({width:400,height:900});await checkPage('itinerary-mobile');await screen('itinerary-mobile');
 await page.goto(`${base}/saved-trips`);await page.getByRole('heading',{name:'Your place shortlist'}).waitFor();await page.getByRole('img',{name:`${broken.name}: ${broken.category} placeholder, no photo`,exact:true}).waitFor();await checkPage('saved-mobile');await screen('saved-mobile');
 if(result.uncreditedRequests!==0)throw Error('Uncredited image was requested');
 result.checks.push({label:'uncredited-local-source-never-requested',ok:true});
 await context.close();
}catch(error){result.error=error.message;process.exitCode=1;console.error('PHOTO_CHECK_STOPPED: '+error.message);}
finally{
 await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));if(prisma)await prisma.$disconnect();
 if(result.created){try{run('dropdb',['--maintenance-db=postgres','--force',db]);result.dropped=sql(`SELECT count(*) FROM pg_database WHERE datname='${db}'`)==='0';}catch{result.cleanupError='Scratch cleanup failed';process.exitCode=1;}}
 save();console.log(JSON.stringify(result,null,2));
}
