const { createClient } = window.supabase;
const SUPABASE_READY =
  window.ALJUST_SUPABASE_URL &&
  window.ALJUST_SUPABASE_KEY &&
  !window.ALJUST_SUPABASE_URL.includes("COLE_AQUI") &&
  !window.ALJUST_SUPABASE_KEY.includes("COLE_AQUI");

const sb = SUPABASE_READY
  ? createClient(window.ALJUST_SUPABASE_URL, window.ALJUST_SUPABASE_KEY)
  : null;

const customerPanel = document.getElementById("customerPanel");
const driverPanel = document.getElementById("driverPanel");
const modeBtn = document.getElementById("modeBtn");
const bottomMode = document.getElementById("bottomMode");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");
const customerMessage = document.getElementById("customerMessage");
const driverMessage = document.getElementById("driverMessage");

let mode = "customer";
let map, pickupMarker, destinationMarker;
let pickupCoords = null, destinationCoords = null;
let rideId = null, driverId = localStorage.getItem("aljust_driver_id") || null;
let driverSubscription = null, rideSubscription = null, driverLocationWatch = null;

function showMessage(el, msg){ el.textContent = msg; }

function setMode(next){
  mode = next;
  customerPanel.classList.toggle("hidden", mode !== "customer");
  driverPanel.classList.toggle("hidden", mode !== "driver");
  modeBtn.textContent = mode === "customer" ? "👨🏽‍✈️ Motorista" : "👤 Passageiro";
  bottomMode.querySelector("span").textContent = mode === "customer" ? "Motorista" : "Passageiro";
  pageTitle.textContent = mode === "customer" ? "Pedir uma corrida" : "Painel do motorista";
  pageSubtitle.textContent = mode === "customer"
    ? "Escolha o local de partida e o destino."
    : "Fique online para receber pedidos.";
  if(mode === "customer") setTimeout(()=>map && map.invalidateSize(),150);
}
modeBtn.addEventListener("click",()=>setMode(mode==="customer"?"driver":"customer"));
bottomMode.addEventListener("click",()=>setMode(mode==="customer"?"driver":"customer"));

if(!SUPABASE_READY){
  showMessage(customerMessage, "Falta configurar o Supabase no ficheiro config.js.");
  showMessage(driverMessage, "Falta configurar o Supabase no ficheiro config.js.");
}

/* MAPA */
map = L.map("map").setView([-8.838333,13.234444],12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom:19, attribution:"&copy; OpenStreetMap contributors"
}).addTo(map);

function kmBetween(a,b){
  const R=6371, r=d=>d*Math.PI/180;
  const dLat=r(b[0]-a[0]), dLon=r(b[1]-a[1]), lat1=r(a[0]), lat2=r(b[0]);
  const h=Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
function updateEstimate(){
  if(!pickupCoords || !destinationCoords){
    document.getElementById("distance").textContent="-- km";
    document.getElementById("price").textContent="-- Kz";
    return;
  }
  const km=kmBetween(pickupCoords,destinationCoords);
  const type=document.getElementById("carType").value;
  const total=Math.max(type==="confort"?1500:1000, Math.round(850 + km*(type==="confort"?450:350)));
  document.getElementById("distance").textContent=km.toFixed(1)+" km";
  document.getElementById("price").textContent=total.toLocaleString("pt-AO")+" Kz";
}
function setPickup(coords,label){
  pickupCoords=coords;
  if(pickupMarker) pickupMarker.remove();
  pickupMarker=L.marker(coords).addTo(map).bindPopup("📍 Partida").openPopup();
  document.getElementById("pickupText").value=label||"Minha localização";
  updateEstimate();
}
function setDestination(coords){
  destinationCoords=coords;
  if(destinationMarker) destinationMarker.remove();
  destinationMarker=L.marker(coords).addTo(map).bindPopup("🎯 Destino").openPopup();
  document.getElementById("destinationText").value=`Destino (${coords[0].toFixed(5)}, ${coords[1].toFixed(5)})`;
  updateEstimate();
}
map.on("click",e=>setDestination([e.latlng.lat,e.latlng.lng]));
document.getElementById("locationBtn").addEventListener("click",()=>{
  if(!navigator.geolocation){showMessage(customerMessage,"Este navegador não suporta GPS.");return;}
  showMessage(customerMessage,"A obter a localização...");
  navigator.geolocation.getCurrentPosition(pos=>{
    const c=[pos.coords.latitude,pos.coords.longitude];
    setPickup(c,"Minha localização");
    map.setView(c,15);
    showMessage(customerMessage,"Partida definida. Toque no mapa para marcar o destino.");
  },()=>showMessage(customerMessage,"Autorize o GPS para usar a sua localização."),
  {enableHighAccuracy:true,timeout:12000});
});
document.getElementById("carType").addEventListener("change",updateEstimate);

/* CLIENTE */
async function requestRide(){
  if(!SUPABASE_READY){showMessage(customerMessage,"Configure o Supabase primeiro.");return;}
  if(!pickupCoords || !destinationCoords){showMessage(customerMessage,"Defina partida e destino no mapa.");return;}
  const name=(document.getElementById("customerName").value||"Cliente").trim();
  const payload={
    customer_name:name,
    pickup_lat:pickupCoords[0], pickup_lng:pickupCoords[1],
    destination_lat:destinationCoords[0], destination_lng:destinationCoords[1],
    pickup_text:document.getElementById("pickupText").value || "Localização GPS",
    destination_text:document.getElementById("destinationText").value || "Destino no mapa",
    passengers:Number(document.getElementById("passengers").value),
    car_type:document.getElementById("carType").value,
    estimated_price:Number((document.getElementById("price").textContent||"0").replace(/\D/g,"")),
    status:"requested"
  };
  showMessage(customerMessage,"A enviar pedido...");
  const {data,error}=await sb.from("rides").insert(payload).select().single();
  if(error){console.error(error);showMessage(customerMessage,"Erro ao enviar pedido: "+error.message);return;}
  rideId=data.id;
  listenToRide(rideId);
  renderRideStatus(data);
  showMessage(customerMessage,"Pedido enviado. A aguardar motorista...");
}
document.getElementById("requestBtn").addEventListener("click",requestRide);

function renderRideStatus(ride){
  const box=document.getElementById("rideStatus");
  box.classList.remove("hidden");
  let text="Pedido enviado — a aguardar motorista.";
  if(ride.status==="accepted") text="Motorista aceitou a corrida.";
  if(ride.status==="started") text="Corrida em andamento.";
  if(ride.status==="completed") text="Corrida concluída.";
  box.innerHTML=`<strong>${text}</strong><small>${ride.driver_id ? "Motorista atribuído ao pedido." : "Nenhum motorista atribuído ainda."}</small>`;
}
function listenToRide(id){
  if(rideSubscription) sb.removeChannel(rideSubscription);
  rideSubscription=sb.channel("ride-"+id)
    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"rides",filter:`id=eq.${id}`},
      payload=>renderRideStatus(payload.new))
    .subscribe();
}

/* MOTORISTA */
function driverForm(){
  return {
    name:document.getElementById("driverName").value.trim(),
    phone:document.getElementById("driverPhone").value.trim(),
    car_model:document.getElementById("driverCar").value.trim(),
    plate:document.getElementById("driverPlate").value.trim()
  };
}
async function goDriverOnline(){
  if(!SUPABASE_READY){showMessage(driverMessage,"Configure o Supabase primeiro.");return;}
  const d=driverForm();
  if(!d.name || !d.phone || !d.plate){
    showMessage(driverMessage,"Preencha nome, telefone e matrícula.");
    return;
  }
  const base={...d,status:"online",updated_at:new Date().toISOString()};
  let result;
  if(driverId){
    result=await sb.from("drivers").update(base).eq("id",driverId).select().single();
  }else{
    result=await sb.from("drivers").insert(base).select().single();
  }
  if(result.error){
    console.error(result.error);
    showMessage(driverMessage,"Erro ao ficar online: "+result.error.message);
    return;
  }
  driverId=result.data.id;
  localStorage.setItem("aljust_driver_id",driverId);
  document.getElementById("driverConnection").textContent="● online";
  document.getElementById("driverConnection").className="online";
  document.getElementById("driverOnlineBtn").textContent="🔴 Ficar offline";
  document.getElementById("driverOnlineBtn").dataset.online="1";
  showMessage(driverMessage,"Está online. Aguardando pedidos...");
  subscribeDriverRequests();
  startDriverLocation();
}
document.getElementById("driverOnlineBtn").addEventListener("click",async()=>{
  const online=document.getElementById("driverOnlineBtn").dataset.online==="1";
  if(!online) return goDriverOnline();
  if(driverId && SUPABASE_READY){
    await sb.from("drivers").update({status:"offline",updated_at:new Date().toISOString()}).eq("id",driverId);
  }
  if(driverLocationWatch!==null) navigator.geolocation.clearWatch(driverLocationWatch);
  document.getElementById("driverConnection").textContent="● offline";
  document.getElementById("driverConnection").className="offline";
  document.getElementById("driverOnlineBtn").textContent="🟢 Ficar online";
  document.getElementById("driverOnlineBtn").dataset.online="0";
  if(driverSubscription) sb.removeChannel(driverSubscription);
  showMessage(driverMessage,"Ficou offline.");
});

async function loadRequestedRides(){
  const {data,error}=await sb.from("rides").select("*").eq("status","requested").order("created_at",{ascending:false});
  if(error){console.error(error);return;}
  renderRequests(data||[]);
}
function subscribeDriverRequests(){
  if(driverSubscription) sb.removeChannel(driverSubscription);
  loadRequestedRides();
  driverSubscription=sb.channel("driver-requests")
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"rides",filter:"status=eq.requested"},
      payload=>addRequest(payload.new))
    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"rides"},
      payload=>loadRequestedRides())
    .subscribe();
}
function renderRequests(list){
  const box=document.getElementById("driverRequests");
  if(!list.length){box.innerHTML='<div class="empty">Nenhum pedido disponível neste momento.</div>';return;}
  box.innerHTML=list.map(r=>requestHtml(r)).join("");
  box.querySelectorAll("[data-accept]").forEach(b=>b.addEventListener("click",()=>acceptRide(b.dataset.accept)));
}
function addRequest(r){
  const box=document.getElementById("driverRequests");
  if(box.querySelector(`[data-accept="${r.id}"]`)) return;
  if(box.querySelector(".empty")) box.innerHTML="";
  box.insertAdjacentHTML("afterbegin",requestHtml(r));
  const b=box.querySelector(`[data-accept="${r.id}"]`);
  b.addEventListener("click",()=>acceptRide(r.id));
}
function requestHtml(r){
  return `<div class="request">
    <strong>🚕 ${escapeHtml(r.customer_name||"Cliente")}</strong>
    <div class="request-row">📍 ${escapeHtml(r.pickup_text||"Partida")}</div>
    <div class="request-row">🎯 ${escapeHtml(r.destination_text||"Destino")}</div>
    <div class="request-row">💰 ${Number(r.estimated_price||0).toLocaleString("pt-AO")} Kz · 👥 ${r.passengers||1}</div>
    <div class="request-actions"><button class="accept" data-accept="${r.id}">Aceitar corrida</button></div>
  </div>`;
}
async function acceptRide(id){
  if(!driverId){showMessage(driverMessage,"Fique online primeiro.");return;}
  const {error}=await sb.from("rides").update({
    status:"accepted",driver_id:driverId,accepted_at:new Date().toISOString()
  }).eq("id",id).eq("status","requested");
  if(error){showMessage(driverMessage,"Não foi possível aceitar: "+error.message);return;}
  showMessage(driverMessage,"Corrida aceite. O cliente verá que encontrou motorista.");
  loadRequestedRides();
}

function startDriverLocation(){
  if(!navigator.geolocation || !driverId) return;
  if(driverLocationWatch!==null) navigator.geolocation.clearWatch(driverLocationWatch);
  driverLocationWatch=navigator.geolocation.watchPosition(async pos=>{
    await sb.from("drivers").update({
      lat:pos.coords.latitude,lng:pos.coords.longitude,updated_at:new Date().toISOString()
    }).eq("id",driverId);
  },()=>{}, {enableHighAccuracy:true,maximumAge:10000,timeout:15000});
}
function escapeHtml(v){
  return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
}

if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
