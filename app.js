/* --- CONFIGURATION --- */
const API_KEY  = "2b10vfT6MvFC2lcAzqG1ZMKO";      // votre clé en clair
const PROJECT  = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
/* --------------------- */

let taxref = {};           // mapping nom latin → CD_REF
fetch("taxref.json").then(r=>r.json()).then(j=>taxref=j);

function inpnUrl(name){
  const cd = taxref[name.toLowerCase()];
  return cd ? `https://inpn.mnhn.fr/espece/cd_nom/${cd}` : "";
}

async function identify(file){
  const fd = new FormData();
  fd.append("images", file, "photo.jpg");
  fd.append("organs", "auto");

  const res = await fetch(ENDPOINT, {method:"POST", body:fd});
  if(!res.ok){ alert("Erreur API Pl@ntNet"); return; }

  const data = await res.json();
  showResults(data.results.slice(0,5));
}

function showResults(arr){
  const ul=document.getElementById("results");
  ul.innerHTML="";
  arr.forEach(({score,species})=>{
    const pct=Math.round(score*100);
    const sci=species.scientificNameWithoutAuthor;
    const li=document.createElement("li");
    const link=inpnUrl(sci);
    li.innerHTML = `<b>${sci}</b> – ${pct}% ${link?`<a href="${link}" target="_blank">INPN</a>`:""}`;
    ul.appendChild(li);
  });
}

document.getElementById("file")
  .addEventListener("change",e=>e.target.files[0]&&identify(e.target.files[0]));
