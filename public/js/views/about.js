import { pickRegion } from '../wi.js';

export default async function about(view) {
  document.body.classList.add('mag');
  view.innerHTML = `<div class="mag-wrap mag-page" style="max-width:900px">
    <p class="mag-kicker">How it works</p>
    <h1 class="mag-h">California's native birds, one photograph at a time.</h1>
    <ol class="how-steps vertical">
      <li><span class="n">1</span><h3>Pick your region</h3><p>California is split into seven regions. Pick the one you bird in most. It is saved on this device only. <button type="button" class="linkish" id="ab-reg">Choose your region</button></p></li>
      <li><span class="n">2</span><h3>Get your nine birds</h3><p>Every season (winter, spring, summer and fall) each region gets nine birds to photograph, three at each level. Level 1 birds are common and easy to find. Level 2 birds need a trip to the right place. Level 3 birds are scarce or hard to see. <a href="/this-season" data-link>See this season's birds</a>.</p></li>
      <li><span class="n">3</span><h3>Photograph them</h3><p>Any of your nine counts. Harder levels score more points. Other birds count too: a bird you find in your region that isn't on your card scores as a frequent visitor, and a rare visitor to California scores the most of all.</p></li>
      <li><span class="n">4</span><h3>Share your best</h3><p>The best photographs are published in the next issue and in the year-end edition. Submissions open with the first issue.</p></li>
    </ol>
    <h2 class="mag-sub">Finding a bird</h2>
    <p class="mag-deck">Every bird in the state has a page under <a href="/birds" data-link>All Birds</a>, with how hard it is to find in each region in each season. Use it to plan where and when to look.</p>
    <h2 class="mag-sub">Birds we never assign</h2>
    <p class="mag-deck">Owls, and birds that nest in colonies or are easily disturbed at the nest, are never on the cards and never score. Neither are seabirds you can only reach by boat. You can still share photos of them in the Gallery.</p>
    <h2 class="mag-sub">Field ethics</h2>
    <p class="mag-deck">No bait, no playback, no flushing, and no getting close to nests. Exact locations of scarce and rare birds are never published.</p>
    <h2 class="mag-sub">Sources</h2>
    <p class="mag-deck">Names and the species list follow the California Bird Records Committee's official state list. Levels are editorial estimates, checked against the USGS Breeding Bird Survey, National Park Service species lists and Audubon Christmas Bird Count results, and reviewed every season.</p>
  </div>`;
  view.querySelector('#ab-reg').onclick = pickRegion;
}
