import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/components/ds/Icon';
import { FOOTER_COLUMNS, LEGAL_LINKS } from '@/lib/nav';
import { SITE } from '@/lib/site';
import styles from './Footer.module.css';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <Image
              src="/brand/logo-wordmark-white.png"
              alt="The Quarter"
              width={140}
              height={56}
              className={styles.logoImg}
            />
            <p className={styles.tagline}>
              So much more than a workspace. A boutique coworking home in Canterbury&rsquo;s Cathedral Quarter.
            </p>
            <div className={styles.address}>
              <Icon name="map-pin" size={16} color="var(--gold-400)" />
              <span>{SITE.address}</span>
            </div>
          </div>

          <div className={styles.cols}>
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title} className={styles.col}>
                <span className={styles.colTitle}>{col.title}</span>
                {col.links.map((l) => (
                  <Link key={l.label} href={l.href} className={styles.colLink}>
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.bottom}>
          <span>© {year} The Quarter, run by the Digital Tourism Think Tank.</span>
          <span className={styles.legal}>
            {LEGAL_LINKS.map((l) => (
              <Link key={l.label} href={l.href} className={styles.legalLink}>
                {l.label}
              </Link>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}
