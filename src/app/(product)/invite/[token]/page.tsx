import InviteFlow from '../../../../components/circles/InviteFlow';

// The URL is a private capability: keep it out of search indexes and out of Referer headers sent to other sites.
export const metadata = {
  title: 'Invitation · Small World',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
} as const;

export default function InvitePage() {
  return <InviteFlow />;
}
