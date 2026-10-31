// Draws assets/stats-{dark,light}.svg: the last 26 weeks of public contributions as ink strokes on
// Cahier paper, with one caption. No dependency, no third-party service, no visitor tracking: it runs
// in this repository's Action with the job's own GITHUB_TOKEN and commits two static SVG files.
import { writeFileSync, mkdirSync } from "node:fs";

const login = process.env.GITHUB_REPOSITORY_OWNER;
const token = process.env.GITHUB_TOKEN;
if (!login || !token) throw new Error("GITHUB_REPOSITORY_OWNER and GITHUB_TOKEN are required");

const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{contributionCount}}}}}}`;
const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { authorization: `bearer ${token}`, "content-type": "application/json", "user-agent": "notebook-stats" },
  body: JSON.stringify({ query, variables: { login } }),
});
if (!res.ok) throw new Error(`GitHub GraphQL answered ${res.status}`);
const { data, errors } = await res.json();
if (errors) throw new Error(JSON.stringify(errors));

const weeks = data.user.contributionsCollection.contributionCalendar.weeks
  .slice(-26)
  .map((w) => w.contributionDays.reduce((n, d) => n + d.contributionCount, 0));
const total = weeks.reduce((a, b) => a + b, 0);
const max = Math.max(1, ...weeks);

// @krizaka/tokens Cahier values (an <img> SVG cannot read CSS variables).
const THEMES = {
  dark: { sheet: "hsl(148 11% 11%)", shadow: "hsl(110 25% 92% / 0.14)", rule: "hsl(140 25% 88% / 0.09)", margin: "hsl(8 64% 66%)", ink: "hsl(140 10% 76%)", pen: "hsl(206 58% 72%)" },
  light: { sheet: "hsl(90 17% 98.5%)", shadow: "hsl(212 49% 24% / 0.22)", rule: "hsl(214 40% 45% / 0.24)", margin: "hsl(5 62% 40%)", ink: "hsl(212 22% 32%)", pen: "hsl(208 54% 33%)" },
};

const W = 1200, H = 150, base = 104, top = 24, x0 = 112, step = 38;
const fmt = new Intl.NumberFormat("fr-CA").format;

function draw(t) {
  const rules = [];
  for (let y = 8 + 32; y < 8 + 126; y += 32) rules.push(`M8 ${y}H1176`);
  const ticks = weeks.map((n, i) => {
    const x = x0 + 24 + i * step;
    const h = n === 0 ? 2 : Math.max(4, Math.round(((base - top) * n) / max));
    return `<path class="tick" style="animation-delay:${(i * 0.04).toFixed(2)}s" d="M${x} ${base}V${base - h}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t">
<title id="t">${fmt(total)} public contributions in the last 26 weeks</title>
<style>
.mono{font-family:"Courier Prime","Courier New",monospace}
.tick{stroke:${t.pen};stroke-width:10;stroke-linecap:butt;transform-box:fill-box;transform-origin:bottom;animation:grow .6s cubic-bezier(.6,0,.2,1) both}
@keyframes grow{from{transform:scaleY(0)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<rect x="16" y="16" width="1168" height="126" fill="${t.shadow}"/>
<rect x="8" y="8" width="1168" height="126" fill="${t.sheet}"/>
<path d="${rules.join("")}" stroke="${t.rule}" fill="none"/>
<path d="M96 8V134" stroke="${t.margin}" stroke-width="1.5"/>
<text class="mono" x="24" y="44" font-size="15" fill="${t.margin}">§ log</text>
<path d="M${x0 + 8} ${base}H${x0 + 40 + 26 * step}" stroke="${t.ink}" stroke-width="1"/>
${ticks.join("\n")}
<text class="mono" x="${x0 + 8}" y="126" font-size="14" fill="${t.margin}">fig. 2 · public contributions, one stroke a week, last 26 weeks · ${fmt(total)} in all</text>
</svg>
`;
}

mkdirSync("assets", { recursive: true });
for (const [mode, t] of Object.entries(THEMES)) writeFileSync(`assets/stats-${mode}.svg`, draw(t));
console.log(`${login}: ${total} contributions over ${weeks.length} weeks`);
