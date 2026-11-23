import { api, toast } from '../util.js';

// Leave the two-week email list.
export default async function unsubscribe(view) {
  view.innerHTML = `<div class="mag-wrap mag-page" style="max-width:720px">
    <p class="mag-kicker">Email</p><h1 class="mag-h">Unsubscribe</h1>
    <p class="mag-deck">Enter the address you signed up with and we'll take it off the list and delete it.</p>
    <form id="uf"><label class="f"><span>Email</span><input type="email" name="email" required autocomplete="email"></label>
      <button class="mag-btn solid" type="submit">Unsubscribe</button></form>
  </div>`;
  view.querySelector('#uf').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/unsubscribe', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.innerHTML = '<p class="mag-deck">Done. If that address was on the list, it has been removed.</p>'; }
    catch (err) { toast(err.message, true); }
  };
}
