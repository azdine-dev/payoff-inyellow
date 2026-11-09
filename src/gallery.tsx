/**
 * A page for looking at every picture of the app in one place, in light and dark: the scene (five stages), the road on
 * the result screen, the road of the short reads, the empty lists, the rings and the preview scene.
 * Dev only: run `npm run dev` and open /gallery.html. Add ?theme=dark (or cream, blue) to see another theme.
 * It is not part of the production build.
 */
import { render } from 'preact';
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/caveat/latin-700.css';
import './styles/tokens.css';
import './styles/base.css';
import type { EmptyArt } from './ui/Empty';
import { Empty } from './ui/Empty';
import { Ring } from './ui/Ring';
import { RoadIllustration } from './ui/Road';
import { Scene, type SceneStage } from './ui/Scene';
import { ReadArt } from './reads/ReadArt';
import type { ReadArtKind } from './copy/reads';
import { PreviewScene } from './path/Preview';

const theme = new URLSearchParams(location.search).get('theme');
if (theme) document.documentElement.setAttribute('data-theme', theme);

const stages: [SceneStage, number][] = [[1, 0], [2, 30], [3, 55], [4, 80], [5, 100]];
const reads: ReadArtKind[] = ['order', 'umbrella', 'house', 'phone', 'clock', 'flag', 'calendar', 'coins', 'bills', 'lifebuoy'];
const empties: EmptyArt[] = ['debts', 'calendar', 'list', 'envelope'];

function Section(props: { id: string; title: string; children: preact.ComponentChildren }) {
  return (
    <section id={props.id} class="stack" style={{ gap: 10 }}>
      <h2>{props.title}</h2>
      <div class="gal-grid">{props.children}</div>
    </section>
  );
}

function Gallery() {
  return (
    <main class="screen" style={{ maxWidth: 980, margin: '0 auto' }}>
      <h1>Pictures</h1>
      <Section id="scene" title="Your scene: five stages">
        {stages.map(([stage, pct]) => (
          <div key={stage} class="card" style={{ padding: 0, overflow: 'hidden' }}>
            <Scene stage={stage} pct={pct} />
            <p class="muted small" style={{ padding: '6px 12px' }}>
              Stage {stage}, {pct}% gone
            </p>
          </div>
        ))}
      </Section>
      <Section id="result-road" title="The road on the result screen">
        {[0, 2, 4, 6, 8].map((done) => (
          <div key={done} class="card">
            <RoadIllustration done={done} width={150} label={`${done} yellow`} />
          </div>
        ))}
      </Section>
      <Section id="preview-scene" title="Preview scene">
        {[[0, 0, 4], [8, 3, 9], [18, 12, 15]].map(([done, at, total]) => (
          <div key={`${done}-${at}`} class="card" style={{ padding: 0, overflow: 'hidden' }}>
            <PreviewScene total={total!} done={done! > 0 ? Math.min(done!, total!) : 0} at={at!} label="Preview" />
          </div>
        ))}
      </Section>
      <Section id="reads" title="Short reads">
        {reads.map((kind) => (
          <div key={kind} class="card" style={{ padding: 0, overflow: 'hidden' }}>
            <ReadArt kind={kind} />
          </div>
        ))}
      </Section>
      <Section id="empty" title="Empty lists">
        {empties.map((art) => (
          <div key={art} class="card">
            <Empty art={art} line={`Empty: ${art}`} />
          </div>
        ))}
      </Section>
      <Section id="rings" title="Rings">
        {[0, 35, 64, 100].map((p) => (
          <div key={p} class="card" style={{ display: 'grid', placeItems: 'center' }}>
            <Ring pct={p} size={96} label={`${p}%`} />
          </div>
        ))}
      </Section>
    </main>
  );
}

render(<Gallery />, document.getElementById('app')!);
