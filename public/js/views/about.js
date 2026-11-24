import { S, esc } from '../util.js';
import { pickRegion } from '../wi.js';

const CREDITS = [
  ['California Bird Records Committee', 'https://californiabirds.org/ca_list.asp', 'The official California state list: all 696 species, with its review, introduced and extirpated flags.'],
  ['American Ornithological Society Check-list, via the Institute for Bird Populations', 'https://www.birdpop.org/pages/birdSpeciesCodes.php', 'English and scientific names, and the order the birds appear in.'],
  ['USGS North American Breeding Bird Survey', 'https://www.usgs.gov/centers/eesc/science/north-american-breeding-bird-survey', 'Public-domain survey data, used to check how common each bird is in spring and summer.'],
  ['National Park Service species lists (NPSpecies)', 'https://irma.nps.gov/NPSpecies/', 'Public-domain lists of the birds recorded in California\'s national parks, used to check regions.'],
  ['Audubon Christmas Bird Count', 'https://www.audubon.org/community-science/christmas-bird-count', 'Volunteer winter counts, used to check winter levels.'],
  ['California Department of Fish and Wildlife', 'https://wildlife.ca.gov/Conservation/CESA', 'State and federal lists of threatened and endangered birds.'],
  ['Wikimedia Commons', 'https://commons.wikimedia.org', 'Reference photos and the sample birds on the wall. Each one is openly licensed and credited to its photographer where it appears.'],
  ['ONNX Runtime and U²-Net', 'https://github.com/xuebinqin/U-2-Net', 'The open-source software that cuts birds out of their backgrounds, on your own device.'],
  ['Archivo and Shippori Mincho', 'https://fonts.google.com', 'The typefaces, both under the SIL Open Font License.'],
];

export default async function about(view) {
  const done = S.species.filter((s) => s.status === 'photographed').length, total = S.species.length;
  view.innerHTML = `<div class="mag-wrap mag-page ab">
    <p class="mag-kicker">Our mission</p>
    <h1 class="mag-h">Photograph every bird in California.</h1>
    <p class="ab-lede">California Bird Atlas is one photographer's attempt to photograph every bird in the state that I can (<a class="linkish" href="/progress" data-link>here's how far I've got</a>), and an open invitation to do it with me. Share your photos. See everyone else's. Get outside.</p>
    <div class="ab-progress" role="img" aria-label="${done} of ${total} species photographed so far">
      <p><b>${done}</b><span>of ${total} species photographed so far</span></p>
      <div class="bar"><i style="width:${Math.max(0.4, (done / total) * 100)}%"></i></div>
    </div>
    <ol class="ab-aims">
      <li><h2>Photograph them all</h2><p>California has ${total} species on its official list, from backyard regulars to once-in-a-decade visitors. The goal is a photograph of every one that can be found. It will take years. That's the point.</p></li>
      <li><h2>Share the work</h2><p>A photo on a hard drive helps nobody. Every bird photographer in the state is invited to send their best, and every photo that goes on the Bird Wall carries its photographer's name.</p></li>
      <li><h2>Get outside</h2><p>Nine new birds every two weeks is a reason to go: to the marsh before work, up the mountain on Saturday, out to the coast in a storm. The photograph is the excuse. Being out there is the reward.</p></li>
      <li><h2>Put the bird first</h2><p>No bait, no playback, no flushing, no crowding a nest. No photograph is worth stressing a bird. Exact locations of scarce and rare birds are never published, and nothing about where you are is collected.</p></li>
    </ol>
    <p class="ab-free">Free to read. No ads. Made from readers' photographs, and built on open data.</p>

    <section class="mag-section" aria-labelledby="ab-how">
      <p class="mag-kicker">How it works</p>
      <h2 id="ab-how">Five steps, start to finish</h2>
      <ol class="how-steps vertical">
        <li><span class="n">1</span><h3>Pick your region</h3><p>California is split into seven regions. Pick the one you bird in most. It is saved on this device only. <button type="button" class="linkish" id="ab-reg">Choose your region</button></p></li>
        <li><span class="n">2</span><h3>Get your nine birds</h3><p>Every two weeks each region gets nine birds to photograph: three easy to find, three that take a trip, three that are hard. A season brings six assignments and up to 54 different birds. <a href="/this-season" data-link>See this season's birds</a>.</p></li>
        <li><span class="n">3</span><h3>Photograph them</h3><p>Any of your nine counts, and so does any bird from an earlier assignment this season. Harder birds score more points. Other birds count too, and a rare visitor to California scores the most of all.</p></li>
        <li><span class="n">4</span><h3>Share your best</h3><p><a href="/submit" data-link>Send a photo</a>. We review it, cut the bird out of its background and add it to the <a href="/wall" data-link>Bird Wall</a> with your name. The best run in the next issue and in the year-end edition.</p></li>
        <li><span class="n">5</span><h3>Or keep it to yourself</h3><p><a href="/my-wall" data-link>My Wall</a> is a private bird wall that lives only in your browser. Add your photos, cut the birds out right there, and send any of them to the public wall when you're ready.</p></li>
      </ol>
    </section>

    <section class="mag-section ab-notes">
      <div><h2 class="mag-sub" id="rotation">How the nine are drawn</h2>
        <p>Seasons start on 1 December, 1 March, 1 June and 1 September, California time. Each has six assignments: five of two weeks and a last one that runs to the end of the season. For each region and level, the birds that can be found there that season are shuffled once and dealt out three at a time. No bird comes back within a season until every eligible bird has had a turn, and a level never has two birds from the same family. The shuffle is fixed by the season, year and region, so everyone in a region gets the same nine, nobody can pick them by hand, and every year is different.</p></div>
      <div><h2 class="mag-sub">Birds we never assign</h2>
        <p>Owls, and birds that nest in colonies or are easily disturbed at the nest, are never assigned and never score. Neither are seabirds you can only reach by boat. Every bird in the state still has a page under <a href="/birds" data-link>All Birds</a>, with how hard it is to find in each region and season.</p></div>
    </section>

    <section class="mag-section" aria-labelledby="ab-cr">
      <p class="mag-kicker">Open data and credits</p>
      <h2 id="ab-cr">Built on other people's work</h2>
      <p class="mag-deck">None of this exists without the people who count, list and photograph birds and share what they find. The levels on this site are our own estimates, checked against these sources and reviewed every season. Any mistakes are ours.</p>
      <ul class="ab-credits">${CREDITS.map(([n, u, t]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a><span>${esc(t)}</span></li>`).join('')}</ul>
    </section>
  </div>`;
  view.querySelector('#ab-reg').onclick = pickRegion;
}
