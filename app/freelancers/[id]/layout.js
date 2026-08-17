// The profile page itself is a client component, so it can't export
// generateMetadata. This server layout wires the per-freelancer metadata
// (title, description, Open Graph / Twitter card) to the route; without it
// Next falls back to the generic site metadata for every profile.
export { generateMetadata } from './metadata'

export default function FreelancerProfileLayout({ children }) {
  return children
}
