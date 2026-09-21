const pickup=document.getElementById("pickup");
const destination=document.getElementById("destination");
const price=document.getElementById("price");
const distanceEl=document.getElementById("distance");
const message=document.getElementById("message");
const carType=document.getElementById("carType");

const map=L.map("map").setView([-8.838333,13.234444],12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(map);

let pickupCoords=null,destinationCoords=null,pickupMarker=null,destinationMarker=null;

function haversineKm(a,b){
 const R=6371,toRad=d=>d*Math.PI/180;
 const dLat=toRad(b[0]-a[0]),dLon=toRad(b[1]-a[1]),lat1=toRad(a[0]),lat2=toRad(b[0]);
 const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
 return 2*R*Math.asin(Math.sqrt(h));
}
function updateEstimate(){
 if(!pickupCoords||!destinationCoords){distanceEl.textContent="-- km";price.textContent="-- Kz";return;}
 const km=haversineKm(pickupCoords,destinationCoords);
 const rate=carType.value==="confort"?450:350;
 const minimum=carType.value==="confort"?1200:1000;
 const total=Math.max(minimum,Math.round(800+km*rate));
 distanceEl.textContent=km.toFixed(1)+" km";
 price.textContent=total.toLocaleString("pt-AO")+" Kz";
}
function setPickup(coords,label){
 pickupCoords=coords;
 if(pickupMarker)pickupMarker.remove();
 pickupMarker=L.marker(coords).addTo(map).bindPopup("📍 Partida").openPopup();
 pickup.value=label||"Minha localização";
 updateEstimate();
}
function setDestination(coords){
 destinationCoords=coords;
 if(destinationMarker)destinationMarker.remove();
 destinationMarker=L.marker(coords).addTo(map).bindPopup("🎯 Destino").openPopup();
 destination.value=`Destino (${coords[0].toFixed(5)}, ${coords[1].toFixed(5)})`;
 updateEstimate();
}
map.on("click",e=>setDestination([e.latlng.lat,e.latlng.lng]));

document.getElementById("locationBtn").addEventListener("click",()=>{
 if(!navigator.geolocation){message.textContent="O seu navegador não suporta localização.";return;}
 message.textContent="A obter a sua localização...";
 navigator.geolocation.getCurrentPosition(pos=>{
   const coords=[pos.coords.latitude,pos.coords.longitude];
   setPickup(coords,"Minha localização");map.setView(coords,15);
   message.textContent="Partida definida. Agora toque no mapa para escolher o destino.";
 },()=>message.textContent="Não foi possível obter a localização. Autorize o GPS.",{enableHighAccuracy:true,timeout:10000});
});
carType.addEventListener("change",updateEstimate);

document.getElementById("requestBtn").addEventListener("click",()=>{
 if(!pickupCoords){message.textContent="Defina primeiro o local de partida.";return;}
 if(!destinationCoords){message.textContent="Toque no mapa para escolher o destino.";return;}
 const req={pickup:pickupCoords,destination:destinationCoords,type:carType.value,passengers:document.getElementById("passengers").value,price:price.textContent,createdAt:new Date().toISOString()};
 localStorage.setItem("aljust_taxi_last_request",JSON.stringify(req));
 message.textContent="Pedido registado no protótipo. A próxima etapa será ligar este pedido aos motoristas reais.";
});
