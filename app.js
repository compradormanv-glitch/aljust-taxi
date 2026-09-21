const pickup=document.getElementById("pickup");
const destination=document.getElementById("destination");
const price=document.getElementById("price");
const message=document.getElementById("message");

function estimate(){
  if(!pickup.value.trim() || !destination.value.trim()){ price.textContent="-- Kz"; return; }
  // Estimativa inicial apenas para protótipo. O cálculo real será ligado ao mapa depois.
  const base=800, variable=Math.floor(Math.random()*900)+600;
  price.textContent=(base+variable).toLocaleString("pt-AO")+" Kz";
}
pickup.addEventListener("input",estimate);
destination.addEventListener("input",estimate);

document.getElementById("locationBtn").addEventListener("click",()=>{
  if(!navigator.geolocation){
    message.textContent="O seu navegador não suporta localização.";
    return;
  }
  message.textContent="A obter a sua localização...";
  navigator.geolocation.getCurrentPosition(
    pos=>{
      pickup.value=`Localização GPS (${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)})`;
      message.textContent="Localização obtida. Agora coloque o destino.";
      estimate();
    },
    ()=>{ message.textContent="Não foi possível obter a localização. Autorize o GPS no navegador."; }
  );
});

document.getElementById("requestBtn").addEventListener("click",()=>{
  if(!pickup.value.trim() || !destination.value.trim()){
    message.textContent="Preencha o local de partida e o destino.";
    return;
  }
  message.textContent="Pedido registado no protótipo. Na próxima etapa ligaremos aos motoristas.";
});

if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(()=>{}); }
