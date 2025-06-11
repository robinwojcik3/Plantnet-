function openObsMultiEmbed(codes){
  if(!Array.isArray(codes) || codes.length===0) return '';
  const q = `(${codes.map(c=>`lsid:${c}`).join(' OR ')}) AND (dynamicProperties_diffusionGP:"true")`;
  return `https://openobs.mnhn.fr/openobs-hub/occurrences/search?q=${encodeURIComponent(q)}&qc=&radius=120.6&lat=45.188529&lon=5.724524&embed=true#tab_mapView`;
}

document.addEventListener('DOMContentLoaded',()=>{
  const params = new URLSearchParams(location.search);
  const raw = params.get('codes') || '';
  const codes = raw.split(',').filter(Boolean);
  if(codes.length){
    document.getElementById('openobs-frame').src = openObsMultiEmbed(codes);
  }
});
