import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let universitiesData = null;

// Load universities data (lazy load, cache after first load)
function loadUniversitiesData() {
  if (universitiesData) return universitiesData;
  
  try {
    // Project structure:
    //   /LOCAL
    //     /backend
    //       /src
    //         /utils  (this file)
    //     /mail/world_universities_and_domains.json
    //
    // So we need to go three levels up from utils (../..../..) to reach project root.
    const dataPath = path.join(__dirname, '../../../mail/world_universities_and_domains.json');
    const data = fs.readFileSync(dataPath, 'utf8');
    universitiesData = JSON.parse(data);
    console.log(`✅ Loaded ${universitiesData.length} universities`);
    return universitiesData;
  } catch (error) {
    console.error('Error loading universities data:', error);
    return [];
  }
}

/**
 * Extract domain from email
 * Handles formats like: user@domain.com, user@subdomain.domain.com
 * Returns the base domain (e.g., "usc.edu" from "user@cs.usc.edu")
 */
export function extractDomainFromEmail(email) {
  if (!email || !email.includes('@')) return null;
  
  const domain = email.split('@')[1].toLowerCase();
  return domain;
}

/**
 * Check if a domain matches a known university domain
 * Handles subdomain cases (e.g., cs.usc.edu matches usc.edu)
 */
export function isUniversityDomain(domain) {
  const data = loadUniversitiesData();
  
  // Direct match
  const directMatch = data.some(uni => 
    uni.domains && uni.domains.some(d => d.toLowerCase() === domain.toLowerCase())
  );
  
  if (directMatch) return true;
  
  // Check if domain is a subdomain of a known university domain
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const testDomain = parts.slice(i).join('.');
    const isMatch = data.some(uni => 
      uni.domains && uni.domains.some(d => d.toLowerCase() === testDomain.toLowerCase())
    );
    if (isMatch) return true;
  }
  
  return false;
}

/**
 * Get university info from email domain
 * Returns: { name, country, domain, alpha_two_code, state_province } or null
 */
export function getUniversityFromEmail(email) {
  const domain = extractDomainFromEmail(email);
  if (!domain) return null;
  
  const data = loadUniversitiesData();
  
  // Try direct match first
  let university = data.find(uni => 
    uni.domains && uni.domains.some(d => d.toLowerCase() === domain.toLowerCase())
  );
  
  if (university) {
    return {
      name: university.name,
      country: university.country,
      domain: domain,
      alpha_two_code: university.alpha_two_code,
      state_province: university['state-province']
    };
  }
  
  // Try subdomain matching (e.g., cs.usc.edu -> usc.edu)
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const testDomain = parts.slice(i).join('.');
    university = data.find(uni => 
      uni.domains && uni.domains.some(d => d.toLowerCase() === testDomain.toLowerCase())
    );
    
    if (university) {
      return {
        name: university.name,
        country: university.country,
        domain: testDomain, // Return the base domain
        alpha_two_code: university.alpha_two_code,
        state_province: university['state-province']
      };
    }
  }
  
  return null;
}

/**
 * Validate if email is from a university domain
 */
export function validateUniversityEmail(email) {
  const domain = extractDomainFromEmail(email);
  if (!domain) return false;
  return isUniversityDomain(domain);
}
