export default async function about(view) {
  document.body.classList.add('mag');
  view.innerHTML = `<div class="mag-wrap mag-page" style="max-width:860px">
    <p class="mag-kicker">About</p>
    <h1 class="mag-h">California's native birds, one photograph at a time.</h1>
    <p class="mag-deck" style="font-size:19px;color:#e6e2da">Every season brings a new assignment for each region of the state: nine birds, three at each level. Pick the region you bird in, go find them, and photograph them.</p>
    <p class="mag-deck" style="font-size:19px;color:#e6e2da">The best photographs run in the next issue and in the year-end edition.</p>
    <p class="mag-deck">Bird names and the species list follow the California Bird Records Committee's official state list. Regional levels are editorial estimates, checked against the USGS Breeding Bird Survey, National Park Service species lists and Audubon Christmas Bird Count results, and reviewed every season.</p>
    <p class="mag-deck">Field ethics come first. No bait, no playback, no flushing, and no getting close to nests. Exact locations of scarce and rare birds are never published.</p>
  </div>`;
}
