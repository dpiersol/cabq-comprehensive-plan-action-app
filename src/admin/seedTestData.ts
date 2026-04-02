import { SAVED_ACTIONS_KEY, type SavedAction } from "../savedActionsStore";
import type { DraftSnapshot, PlanItemSelection } from "../draftStorage";
import { emptyContact } from "../contacts";

let seqId = 0;
function nextId(): string {
  seqId++;
  return `seed-${seqId.toString().padStart(4, "0")}-${Date.now().toString(36)}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(8 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60));
  return d.toISOString();
}

function plan(ch: number, g: number, gd: number, p: number): PlanItemSelection {
  return { chapterIdx: ch, goalIdx: g, goalDetailIdx: gd, policyIdx: p, subPolicyIdx: -1, subLevelIdx: -1 };
}

interface Rec {
  dept: string;
  title: string;
  details: string;
  howFurthers: string;
  primary: { name: string; role: string; email: string; phone: string };
  alternate?: { name: string; role: string; email: string; phone: string };
  planItems: PlanItemSelection[];
}

const records: Rec[] = [
  // ── Animal Welfare ──
  {
    dept: "Animal Welfare",
    title: "Mobile Spay/Neuter Clinic Expansion",
    details: "Expand mobile veterinary clinic services to underserved South Valley and West Mesa neighborhoods. Program will add two additional mobile units and partner with community organizations to provide free spay/neuter, vaccination, and microchipping services.",
    howFurthers: "Improves community services accessibility in underserved areas and supports responsible pet ownership, reducing animal shelter intake and strengthening neighborhood quality of life.",
    primary: { name: "Maria Gonzalez", role: "Program Director", email: "mgonzalez@cabq.gov", phone: "505-555-0101" },
    alternate: { name: "James Rivera", role: "Veterinary Services Manager", email: "jrivera@cabq.gov", phone: "505-555-0102" },
    planItems: [plan(8, 1, 0, 1)],
  },
  {
    dept: "Animal Welfare",
    title: "Community Cat TNR Program Funding",
    details: "Secure dedicated annual funding for the Trap-Neuter-Return program for community cats. Includes outreach education, colony caretaker support, and monitoring of managed cat colonies across the metro area.",
    howFurthers: "Supports sustainable community health management practices and reduces the strain on public animal shelter resources while promoting humane treatment of animals.",
    primary: { name: "Sandra Montoya", role: "TNR Coordinator", email: "smontoya@cabq.gov", phone: "505-555-0103" },
    planItems: [plan(8, 1, 0, 0)],
  },

  // ── Parks and Recreation ──
  {
    dept: "Parks and Recreation",
    title: "Bosque Trail Rehabilitation Phase III",
    details: "Complete the third phase of the Rio Grande Bosque multi-use trail rehabilitation, including resurfacing 4.2 miles of existing trail, installing new wayfinding signage, adding emergency call stations, and restoring native riparian vegetation along eroded sections.",
    howFurthers: "Directly enhances multi-use trail connectivity and park safety, supports environmental stewardship of the Bosque, and improves recreational access for all residents.",
    primary: { name: "Carlos Padilla", role: "Parks Planning Manager", email: "cpadilla@cabq.gov", phone: "505-555-0201" },
    alternate: { name: "Diana Trujillo", role: "Capital Projects Coordinator", email: "dtrujillo@cabq.gov", phone: "505-555-0202" },
    planItems: [plan(6, 1, 0, 2), plan(6, 0, 0, 1)],
  },
  {
    dept: "Parks and Recreation",
    title: "Westside Community Center Expansion",
    details: "Construct a 12,000 square foot addition to the Taylor Ranch Community Center to include an indoor gymnasium, multipurpose rooms, and expanded senior programming space. Project addresses the growing population on the Westside.",
    howFurthers: "Meets community facility needs for the growing Westside population, provides equitable access to recreational programming, and supports complete community development.",
    primary: { name: "Robert Chen", role: "Facilities Director", email: "rchen@cabq.gov", phone: "505-555-0203" },
    planItems: [plan(8, 1, 0, 2), plan(6, 0, 0, 0)],
  },
  {
    dept: "Parks and Recreation",
    title: "Urban Food Forest Pilot Program",
    details: "Establish three urban food forest installations in underserved neighborhoods (International District, South Broadway, Barelas). Each site will feature drought-tolerant fruit and nut trees, community garden beds, educational signage, and gathering spaces.",
    howFurthers: "Supports urban agriculture goals, promotes food security in food-desert neighborhoods, and creates green community gathering spaces that enhance neighborhood identity.",
    primary: { name: "Lisa Baca", role: "Community Programs Manager", email: "lbaca@cabq.gov", phone: "505-555-0204" },
    planItems: [plan(6, 0, 0, 2)],
  },

  // ── Transit ──
  {
    dept: "Transit",
    title: "ART Corridor Signal Priority Upgrade",
    details: "Install transit signal priority (TSP) technology along the full ART corridor on Central Avenue. This upgrade will allow ART buses to extend green lights or trigger early green phases, reducing travel times by an estimated 15-20%.",
    howFurthers: "Improves transit reliability and efficiency along the city's primary transit corridor, supporting transit-oriented development and reducing automobile dependency.",
    primary: { name: "Michael Torres", role: "Transit Operations Director", email: "mtorres@cabq.gov", phone: "505-555-0301" },
    alternate: { name: "Angela Martinez", role: "ITS Engineer", email: "amartinez@cabq.gov", phone: "505-555-0302" },
    planItems: [plan(2, 0, 0, 1), plan(2, 1, 0, 0)],
  },
  {
    dept: "Transit",
    title: "Zero-Emission Bus Fleet Conversion Plan",
    details: "Develop a 10-year transition plan to convert the entire ABQ RIDE bus fleet from diesel/CNG to battery-electric vehicles. Includes charging infrastructure design, workforce retraining, and phased procurement schedule aligned with federal funding opportunities.",
    howFurthers: "Supports greenhouse gas reduction targets, aligns transit infrastructure with sustainability goals, and positions the city for federal clean transit funding.",
    primary: { name: "Patricia Romero", role: "Fleet Planning Manager", email: "promero@cabq.gov", phone: "505-555-0303" },
    planItems: [plan(9, 0, 0, 1)],
  },

  // ── Planning ──
  {
    dept: "Planning",
    title: "International District Sector Development Plan",
    details: "Initiate a comprehensive sector development plan for the International District, including community visioning workshops, land use analysis, infrastructure needs assessment, and design guidelines. The plan will guide zoning decisions and capital investments for the next 15 years.",
    howFurthers: "Implements community planning area assessment process, supports distinct community identity, and provides framework for equitable development in one of the city's most diverse neighborhoods.",
    primary: { name: "Jennifer Valdez", role: "Senior Planner", email: "jvaldez@cabq.gov", phone: "505-555-0401" },
    alternate: { name: "Andrew Kim", role: "Planning Director", email: "akim@cabq.gov", phone: "505-555-0402" },
    planItems: [plan(0, 1, 0, 0), plan(0, 0, 0, 0)],
  },
  {
    dept: "Planning",
    title: "Missing Middle Housing Code Reform",
    details: "Amend the Integrated Development Ordinance to reduce barriers for missing middle housing types (duplexes, triplexes, cottage courts, townhomes) in appropriate locations throughout the city, particularly near transit corridors and activity centers.",
    howFurthers: "Directly supports housing supply and affordability goals, promotes land use diversity, and enables transit-supportive residential density along key corridors.",
    primary: { name: "David Lujan", role: "Zoning Administrator", email: "dlujan@cabq.gov", phone: "505-555-0403" },
    planItems: [plan(5, 0, 0, 0), plan(5, 0, 0, 1)],
  },
  {
    dept: "Planning",
    title: "Complete Streets Design Manual Update",
    details: "Update the city's Complete Streets design manual to incorporate latest NACTO guidelines, Vision Zero principles, and climate resilience standards. Manual will include new cross-section templates for Centers and Corridors as identified in the Comp Plan.",
    howFurthers: "Aligns street design standards with comprehensive plan policies for multi-modal transportation, pedestrian safety, and context-sensitive design in activity centers.",
    primary: { name: "Sarah Quintana", role: "Transportation Planner", email: "squintana@cabq.gov", phone: "505-555-0404" },
    planItems: [plan(2, 1, 0, 1)],
  },

  // ── Police ──
  {
    dept: "Police",
    title: "Community Policing Substation - South Valley",
    details: "Establish a new community policing substation in the South Valley to improve response times and strengthen police-community relationships. The facility will include community meeting space, officer workstations, and a public lobby for filing reports.",
    howFurthers: "Enhances community safety services in an underserved area, supports community facility siting in high-need locations, and strengthens neighborhood-level policing partnerships.",
    primary: { name: "Lt. Raymond Gallegos", role: "Community Policing Commander", email: "rgallegos@cabq.gov", phone: "505-555-0501" },
    alternate: { name: "Sgt. Michelle Archuleta", role: "South Valley Area Commander", email: "marchuleta@cabq.gov", phone: "505-555-0502" },
    planItems: [plan(8, 1, 0, 2)],
  },
  {
    dept: "Police",
    title: "Real-Time Crime Center Technology Upgrade",
    details: "Upgrade the Real-Time Crime Center with advanced video analytics, integrated license plate reader feeds, and enhanced data fusion capabilities. Includes training for 20 analysts and privacy impact assessment.",
    howFurthers: "Improves public safety infrastructure and community service delivery, leveraging technology to enhance emergency response and crime prevention capabilities.",
    primary: { name: "Capt. Derek Sanchez", role: "Technology Division Commander", email: "dsanchez@cabq.gov", phone: "505-555-0503" },
    planItems: [plan(8, 0, 0, 0)],
  },

  // ── Economic Development ──
  {
    dept: "Economic Development",
    title: "Small Business Microloan Revolving Fund",
    details: "Create a $2M revolving microloan fund targeting small businesses in underserved communities. Loans of $5,000-$50,000 at below-market rates for startups and existing businesses in designated Metropolitan Redevelopment Areas.",
    howFurthers: "Directly supports local business development, promotes economic resilience, and targets investment in areas identified for metropolitan redevelopment.",
    primary: { name: "Rachel Herrera", role: "Economic Development Manager", email: "rherrera@cabq.gov", phone: "505-555-0601" },
    alternate: { name: "Thomas Begay", role: "Small Business Liaison", email: "tbegay@cabq.gov", phone: "505-555-0602" },
    planItems: [plan(4, 1, 0, 0), plan(4, 0, 0, 1)],
  },
  {
    dept: "Economic Development",
    title: "Innovation District Designation - Mesa del Sol",
    details: "Establish a formal Innovation District at Mesa del Sol with targeted incentives for technology companies, research partnerships with UNM and CNM, shared workspace facilities, and a fast-track permitting process for qualifying businesses.",
    howFurthers: "Strengthens and diversifies the economic base, promotes entrepreneurship and diverse talent development, and supports sustainable business incentive programs.",
    primary: { name: "Natalie Chaves", role: "Innovation Programs Director", email: "nchaves@cabq.gov", phone: "505-555-0603" },
    planItems: [plan(4, 0, 0, 2), plan(4, 1, 0, 1)],
  },

  // ── Fire ──
  {
    dept: "Fire",
    title: "Wildland-Urban Interface Mitigation Program",
    details: "Launch a comprehensive wildland-urban interface fire mitigation program for East Mountain and foothill communities. Program includes defensible space assessments, community fuel reduction projects, and public education campaigns.",
    howFurthers: "Addresses climate resilience by reducing wildfire risk, protects community safety and natural resources, and promotes adaptation strategies for changing environmental conditions.",
    primary: { name: "Chief Laura Espinosa", role: "Wildland Division Chief", email: "lespinosa@cabq.gov", phone: "505-555-0701" },
    planItems: [plan(9, 0, 0, 2)],
  },
  {
    dept: "Fire",
    title: "Station 19 Replacement and Relocation",
    details: "Replace aging Fire Station 19 in the North Valley with a new facility at a site that improves coverage for the rapidly growing Alameda/North Valley area. New station will include enhanced EMS capabilities and a community room.",
    howFurthers: "Supports community facility improvement and equitable distribution of emergency services, siting a new facility in a high-growth area to maintain response standards.",
    primary: { name: "Deputy Chief Marcus Tapia", role: "Operations Deputy Chief", email: "mtapia@cabq.gov", phone: "505-555-0702" },
    alternate: { name: "Battalion Chief Anna Roybal", role: "Station Planning", email: "aroybal@cabq.gov", phone: "505-555-0703" },
    planItems: [plan(8, 1, 0, 2)],
  },

  // ── Environmental Health ──
  {
    dept: "Environmental Health",
    title: "Air Quality Monitoring Network Expansion",
    details: "Deploy 25 additional low-cost air quality sensors across the metro area with emphasis on environmental justice communities. Data will be publicly accessible via an online dashboard and used to inform land use and transportation planning decisions.",
    howFurthers: "Promotes environmental justice and public health monitoring, supports data-driven planning decisions, and increases transparency in environmental conditions reporting.",
    primary: { name: "Dr. Sofia Armijo", role: "Air Quality Bureau Chief", email: "sarmijo@cabq.gov", phone: "505-555-0801" },
    planItems: [plan(9, 0, 0, 0)],
  },
  {
    dept: "Environmental Health",
    title: "Brownfield Remediation and Redevelopment Initiative",
    details: "Pursue EPA Brownfields Assessment and Cleanup grants for five priority sites along the North I-25 corridor. Program includes environmental site assessments, community engagement, cleanup planning, and reuse visioning for contaminated properties.",
    howFurthers: "Supports sustainable land use by returning contaminated properties to productive use, promotes economic development on underutilized sites, and reduces environmental health risks.",
    primary: { name: "Mark Delgado", role: "Remediation Program Manager", email: "mdelgado@cabq.gov", phone: "505-555-0802" },
    planItems: [plan(1, 0, 0, 1), plan(9, 0, 0, 0)],
  },
  {
    dept: "Environmental Health",
    title: "Restaurant Food Safety Modernization",
    details: "Modernize the restaurant inspection program with tablet-based real-time inspection reporting, online permit applications, and a public-facing restaurant grades database. Reduces inspection turnaround from 14 days to same-day posting.",
    howFurthers: "Improves community health services delivery, increases transparency, and modernizes public-facing infrastructure using technology innovations.",
    primary: { name: "Carmen Vigil", role: "Food Safety Supervisor", email: "cvigil@cabq.gov", phone: "505-555-0803" },
    planItems: [plan(8, 0, 0, 0)],
  },

  // ── Municipal Development ──
  {
    dept: "Municipal Development",
    title: "Lead Water Line Replacement Acceleration",
    details: "Accelerate replacement of remaining lead service lines in pre-1986 residential neighborhoods. Program targets 2,000 line replacements annually with priority given to low-income households and childcare facilities. Includes free water testing.",
    howFurthers: "Addresses critical water infrastructure needs, protects public health, and targets investment to underserved communities aligned with equity priorities.",
    primary: { name: "George Medina", role: "Water Utility Director", email: "gmedina@cabq.gov", phone: "505-555-0901" },
    alternate: { name: "Elena Apodaca", role: "Capital Projects Engineer", email: "eapodaca@cabq.gov", phone: "505-555-0902" },
    planItems: [plan(8, 0, 0, 1), plan(9, 1, 0, 0)],
  },
  {
    dept: "Municipal Development",
    title: "Stormwater Green Infrastructure Master Plan",
    details: "Develop a comprehensive green infrastructure master plan for stormwater management. Plan will identify priority locations for bioswales, rain gardens, permeable pavement, and detention basins that also serve as parks and community amenities.",
    howFurthers: "Integrates water quality protection with urban design, supports climate resilience through green infrastructure, and creates multi-benefit public spaces.",
    primary: { name: "Isabel Fresquez", role: "Stormwater Program Manager", email: "ifresquez@cabq.gov", phone: "505-555-0903" },
    planItems: [plan(9, 1, 0, 2), plan(9, 0, 0, 2)],
  },

  // ── Health Housing and Homelessness ──
  {
    dept: "Health Housing and Homelessness",
    title: "Gateway Center Expansion - Supportive Housing",
    details: "Expand the Gateway Center campus with a new 80-unit permanent supportive housing building. Units will serve chronically homeless individuals with wraparound services including behavioral health, employment assistance, and life skills training.",
    howFurthers: "Directly addresses housing supply for the most vulnerable populations, supports fair housing principles, and integrates supportive services with housing development.",
    primary: { name: "Dr. Angela Ortiz", role: "Homelessness Solutions Director", email: "aortiz@cabq.gov", phone: "505-555-1001" },
    alternate: { name: "Kevin Sandoval", role: "Housing Programs Manager", email: "ksandoval@cabq.gov", phone: "505-555-1002" },
    planItems: [plan(5, 0, 0, 0), plan(5, 0, 0, 2)],
  },
  {
    dept: "Health Housing and Homelessness",
    title: "Behavioral Health Crisis Response Teams",
    details: "Deploy four new co-responder teams pairing licensed clinicians with community safety officers for behavioral health crisis calls. Program diverts non-violent mental health calls from traditional law enforcement response.",
    howFurthers: "Improves community health and safety service delivery, provides appropriate crisis response resources, and supports equitable access to behavioral health services.",
    primary: { name: "Dr. Rebecca Jaramillo", role: "Behavioral Health Bureau Chief", email: "rjaramillo@cabq.gov", phone: "505-555-1003" },
    planItems: [plan(8, 1, 0, 0)],
  },

  // ── Solid Waste ──
  {
    dept: "Solid Waste",
    title: "Citywide Composting Program Launch",
    details: "Implement a residential curbside composting collection program in three pilot areas (Northeast Heights, Downtown, South Valley). Includes distribution of compost bins, weekly collection, and processing at a new composting facility adjacent to Cerro Colorado Landfill.",
    howFurthers: "Supports waste reduction and sustainability objectives, reduces landfill usage, and promotes environmental stewardship through circular economy practices.",
    primary: { name: "Frank Lucero", role: "Solid Waste Division Manager", email: "flucero@cabq.gov", phone: "505-555-1101" },
    planItems: [plan(9, 0, 0, 0), plan(9, 0, 0, 1)],
  },
  {
    dept: "Solid Waste",
    title: "Illegal Dumping Enforcement and Cleanup",
    details: "Enhance the illegal dumping enforcement program with dedicated code enforcement officers, surveillance cameras at hot spots, increased penalties, and quarterly neighborhood cleanup events in partnership with community organizations.",
    howFurthers: "Protects environmental quality and neighborhood character, promotes community engagement in maintaining clean and safe neighborhoods, and deters environmental violations.",
    primary: { name: "Rosa Garcia", role: "Code Enforcement Supervisor", email: "rgarcia@cabq.gov", phone: "505-555-1102" },
    planItems: [plan(0, 0, 0, 0)],
  },

  // ── Arts and Culture ──
  {
    dept: "Arts and Culture",
    title: "Public Art Master Plan Update",
    details: "Comprehensive update to the city's Public Art Master Plan including new priorities for underrepresented neighborhoods, integration with transit corridors, artist equity initiatives, and maintenance endowment planning for the existing $30M collection.",
    howFurthers: "Enhances community identity through arts integration, supports placemaking in transit corridors and activity centers, and promotes diverse cultural expression.",
    primary: { name: "Alejandra Ruiz", role: "Public Art Program Director", email: "aruiz@cabq.gov", phone: "505-555-1201" },
    alternate: { name: "Nathan Black", role: "Cultural Services Manager", email: "nblack@cabq.gov", phone: "505-555-1202" },
    planItems: [plan(0, 0, 0, 2), plan(3, 0, 0, 0)],
  },
  {
    dept: "Arts and Culture",
    title: "Creative Economy Incubator Space",
    details: "Develop a 15,000 sq ft creative economy incubator in Downtown Albuquerque providing subsidized studio, gallery, and maker spaces for emerging artists and creative entrepreneurs. Includes business development workshops and gallery exhibition programs.",
    howFurthers: "Supports local creative business development and entrepreneurship, fosters diverse and interesting places in the downtown core, and strengthens the cultural economy.",
    primary: { name: "Camille Lovato", role: "Creative Economy Director", email: "clovato@cabq.gov", phone: "505-555-1203" },
    planItems: [plan(4, 1, 0, 0), plan(4, 0, 0, 0)],
  },

  // ── Tech and Innovation ──
  {
    dept: "Tech and Innovation",
    title: "Smart City Sensor Network Deployment",
    details: "Deploy an IoT sensor network across 200 intersections for real-time traffic monitoring, air quality measurement, and noise level tracking. Data feeds into a centralized city dashboard for cross-departmental analytics and public transparency.",
    howFurthers: "Modernizes city infrastructure with technology, supports data-driven policy decisions, and improves transportation system monitoring aligned with multi-modal planning goals.",
    primary: { name: "Ryan Yazzie", role: "Smart City Program Lead", email: "ryazzie@cabq.gov", phone: "505-555-1301" },
    planItems: [plan(2, 0, 0, 0), plan(8, 0, 0, 0)],
  },
  {
    dept: "Tech and Innovation",
    title: "Digital Equity Broadband Mapping",
    details: "Conduct a comprehensive broadband availability and adoption survey across all zip codes. Produce an interactive map identifying connectivity gaps, prioritize areas for municipal broadband investment, and develop a digital literacy partnership with ABQ libraries.",
    howFurthers: "Addresses infrastructure equity gaps, supports community facility programming, and enables data-driven investment in underserved neighborhoods.",
    primary: { name: "Priya Sharma", role: "Digital Equity Coordinator", email: "psharma@cabq.gov", phone: "505-555-1302" },
    planItems: [plan(8, 0, 0, 0)],
  },

  // ── General Services ──
  {
    dept: "General Services",
    title: "Municipal Building Energy Retrofit Program",
    details: "Implement energy efficiency retrofits across 15 city-owned buildings including LED lighting, HVAC upgrades, building envelope improvements, and rooftop solar installations. Projected to reduce energy costs by 30% and carbon emissions by 2,500 tons annually.",
    howFurthers: "Directly supports greenhouse gas mitigation goals, promotes resource-efficient public infrastructure, and reduces long-term operating costs for municipal facilities.",
    primary: { name: "Victor Salazar", role: "Facilities Manager", email: "vsalazar@cabq.gov", phone: "505-555-1401" },
    alternate: { name: "Amy Tafoya", role: "Energy Programs Coordinator", email: "atafoya@cabq.gov", phone: "505-555-1402" },
    planItems: [plan(9, 0, 0, 1), plan(9, 0, 0, 2)],
  },
  {
    dept: "General Services",
    title: "Fleet Electrification Phase I",
    details: "Replace 75 light-duty city fleet vehicles with electric vehicles and install 50 Level 2 charging stations at city facilities. Includes driver training, maintenance staff certification, and utility rate optimization for fleet charging.",
    howFurthers: "Supports climate change mitigation through reduced fleet emissions, modernizes city infrastructure, and positions the city as a leader in sustainable municipal operations.",
    primary: { name: "Daniel Cordova", role: "Fleet Director", email: "dcordova@cabq.gov", phone: "505-555-1403" },
    planItems: [plan(9, 0, 0, 1)],
  },

  // ── Community Safety ──
  {
    dept: "Community Safety",
    title: "Violence Intervention Program Expansion",
    details: "Expand the Community Violence Intervention (CVI) program to cover four additional high-violence zones. Adds 12 credible messengers, enhances hospital-based intervention at UNMH, and establishes a 24/7 crisis hotline with bilingual operators.",
    howFurthers: "Improves community safety through evidence-based intervention, addresses root causes of violence in underserved communities, and supports equitable service delivery.",
    primary: { name: "Joaquin Perea", role: "CVI Program Director", email: "jperea@cabq.gov", phone: "505-555-1501" },
    planItems: [plan(8, 1, 0, 0)],
  },
  {
    dept: "Community Safety",
    title: "Safe Routes to School Infrastructure",
    details: "Design and construct pedestrian safety improvements along 15 priority school zones including high-visibility crosswalks, rectangular rapid flashing beacons, school zone signage, and ADA-compliant curb ramps. Prioritizes Title I schools.",
    howFurthers: "Enhances pedestrian safety and walkability near schools, supports complete streets and multi-modal transportation goals, and targets investments in underserved communities.",
    primary: { name: "Veronica Luna", role: "Safe Streets Coordinator", email: "vluna@cabq.gov", phone: "505-555-1502" },
    alternate: { name: "Chris Gutierrez", role: "Traffic Engineer", email: "cgutierrez@cabq.gov", phone: "505-555-1503" },
    planItems: [plan(2, 1, 0, 2), plan(3, 1, 0, 0)],
  },

  // ── Senior Affairs ──
  {
    dept: "Senior Affairs",
    title: "Age-Friendly Action Plan Implementation",
    details: "Implement Phase II of the WHO Age-Friendly City Action Plan including expanded Meals on Wheels routes, a senior transportation voucher program, age-friendly park amenities, and intergenerational programming at community centers.",
    howFurthers: "Supports universal design in parks and community facilities, promotes equitable access to services for aging populations, and enhances quality of life across the age spectrum.",
    primary: { name: "Martha Lucero", role: "Senior Programs Director", email: "mlucero@cabq.gov", phone: "505-555-1601" },
    planItems: [plan(6, 0, 0, 1), plan(8, 1, 0, 0)],
  },
  {
    dept: "Senior Affairs",
    title: "Senior Center Modernization - Barelas",
    details: "Renovate the Barelas Senior Center with modern kitchen facilities, expanded activity space, technology lab with computer literacy programs, and outdoor courtyard with shade structures and accessible gardens.",
    howFurthers: "Improves existing community facility quality, supports heritage conservation in the Barelas neighborhood, and provides accessible programming space for senior residents.",
    primary: { name: "Richard Maestas", role: "Facilities Coordinator", email: "rmaestas@cabq.gov", phone: "505-555-1602" },
    planItems: [plan(8, 1, 0, 1)],
  },

  // ── Metro Redevelopment Agency ──
  {
    dept: "Metro Redevelopment Agency",
    title: "Downtown Albuquerque Streetscape Revitalization",
    details: "Comprehensive streetscape improvements along Gold and Silver Avenues from 1st Street to 8th Street. Includes wider sidewalks, street trees, pedestrian-scale lighting, outdoor dining zones, and enhanced transit stops. Total investment: $8.5M.",
    howFurthers: "Transforms downtown streets into walkable, vibrant public spaces that support economic development, pedestrian-accessible design, and transit-oriented placemaking.",
    primary: { name: "Christina Pino", role: "MRA Executive Director", email: "cpino@cabq.gov", phone: "505-555-1701" },
    alternate: { name: "Leo Abeyta", role: "Project Manager", email: "labeyta@cabq.gov", phone: "505-555-1702" },
    planItems: [plan(3, 0, 0, 0), plan(3, 1, 0, 1), plan(4, 0, 0, 0)],
  },
  {
    dept: "Metro Redevelopment Agency",
    title: "East Gateway Mixed-Use Development",
    details: "Partner with private developers to catalyze a mixed-use project at the East Gateway site (Central and Tramway). Project includes 200 residential units, 30,000 sq ft of ground-floor retail, structured parking, and a public plaza connected to ART.",
    howFurthers: "Supports center and corridor development patterns, promotes mixed-use transit-oriented development, and demonstrates public-private partnership model for growth areas.",
    primary: { name: "Nathan Abeyta", role: "Redevelopment Specialist", email: "nabeyta@cabq.gov", phone: "505-555-1703" },
    planItems: [plan(1, 0, 0, 1), plan(1, 1, 0, 0)],
  },

  // ── Office of Equity and Inclusion ──
  {
    dept: "Office of Equity and Inclusion",
    title: "Equity Impact Assessment Framework",
    details: "Develop and implement a standardized equity impact assessment framework for all major city policies, programs, and capital projects. Includes staff training, community advisory panel, data dashboard, and annual equity report card.",
    howFurthers: "Embeds equity principles into city decision-making, supports fair housing and community engagement goals, and ensures comprehensive plan implementation benefits all residents.",
    primary: { name: "Dr. Marisol Cruz", role: "Chief Equity Officer", email: "mcruz@cabq.gov", phone: "505-555-1801" },
    planItems: [plan(0, 1, 0, 1)],
  },
  {
    dept: "Office of Equity and Inclusion",
    title: "Multilingual City Services Initiative",
    details: "Expand multilingual access to city services including translated web content in five languages, interpretation services at public meetings, bilingual signage at city facilities, and a language access hotline for non-English speakers.",
    howFurthers: "Promotes inclusive community engagement, removes barriers to public services participation, and supports the diverse identity of Albuquerque's communities.",
    primary: { name: "Fatima Al-Hassan", role: "Language Access Coordinator", email: "falhassan@cabq.gov", phone: "505-555-1802" },
    planItems: [plan(0, 1, 0, 1), plan(0, 0, 0, 0)],
  },

  // ── Aviation ──
  {
    dept: "Aviation",
    title: "Sunport Terminal Modernization Phase II",
    details: "Continue terminal modernization with consolidated security checkpoint, expanded post-security concessions, electric ground support equipment, and real-time passenger flow analytics. Project supports projected 30% growth in enplanements over the next decade.",
    howFurthers: "Strengthens regional economic infrastructure, modernizes a critical community facility, and supports sustainable operations through electrification of ground equipment.",
    primary: { name: "James Westbrook", role: "Aviation Planning Director", email: "jwestbrook@cabq.gov", phone: "505-555-1901" },
    planItems: [plan(8, 0, 0, 0), plan(4, 0, 0, 2)],
  },
  {
    dept: "Aviation",
    title: "Double Eagle II Airport Solar Farm",
    details: "Develop a 5MW solar photovoltaic installation on underutilized land at Double Eagle II Airport. Energy will offset airport operations and be available to the grid. Includes battery storage for peak demand management.",
    howFurthers: "Supports renewable energy and greenhouse gas reduction goals, demonstrates sustainable infrastructure investment, and generates revenue from underutilized public land.",
    primary: { name: "Karen Tsosie", role: "Airport Manager - DEII", email: "ktsosie@cabq.gov", phone: "505-555-1902" },
    planItems: [plan(9, 0, 0, 1)],
  },

  // ── Youth and Family Services ──
  {
    dept: "Youth and Family Services",
    title: "Youth Employment Pipeline Program",
    details: "Create a year-round youth employment program connecting 500 young people ages 16-24 with paid internships, job skills training, mentorship, and career pathways in city government and partner organizations. Priority for opportunity youth not in school or work.",
    howFurthers: "Supports diverse talent development, promotes economic opportunity for underserved youth, and strengthens the pipeline for a skilled local workforce.",
    primary: { name: "Monica Saiz", role: "Youth Programs Director", email: "msaiz@cabq.gov", phone: "505-555-2001" },
    alternate: { name: "Jerome Williams", role: "Workforce Development Manager", email: "jwilliams@cabq.gov", phone: "505-555-2002" },
    planItems: [plan(4, 1, 0, 1)],
  },
  {
    dept: "Youth and Family Services",
    title: "Family Resource Center - Southeast",
    details: "Open a new Family Resource Center in the Southeast Heights offering co-located services: childcare assistance, parenting classes, SNAP/WIC enrollment, legal aid referrals, and after-school programming. One-stop-shop model reduces barriers for families.",
    howFurthers: "Provides equitable access to family support services, sites community facilities in high-need areas, and supports a complete communities approach to service delivery.",
    primary: { name: "Linda Barela", role: "Family Services Coordinator", email: "lbarela@cabq.gov", phone: "505-555-2003" },
    planItems: [plan(8, 1, 0, 2), plan(1, 1, 0, 0)],
  },

  // ── Heritage Conservation (under Planning umbrella) ──
  {
    dept: "Planning",
    title: "Historic Route 66 Corridor Preservation Plan",
    details: "Develop a preservation and economic development plan for the Historic Route 66 corridor (Central Avenue from the Rio Grande to Tramway). Includes historic resource survey, design overlay guidelines, heritage tourism strategy, and adaptive reuse incentives.",
    howFurthers: "Preserves and enhances distinct built environments along a historically significant corridor, balances preservation with economic development, and supports heritage tourism.",
    primary: { name: "Margaret Anaya", role: "Historic Preservation Officer", email: "manaya@cabq.gov", phone: "505-555-2101" },
    planItems: [plan(7, 1, 0, 2), plan(7, 1, 0, 0)],
  },

  // ── Legal ──
  {
    dept: "Legal",
    title: "City Code Modernization and Digitization",
    details: "Comprehensive review and modernization of the city code of ordinances, converting to a fully searchable digital platform with version tracking, plain-language summaries, and automated cross-referencing. Eliminates outdated and conflicting provisions.",
    howFurthers: "Improves public transparency and access to city regulations, supports efficient governance, and aligns regulatory framework with comprehensive plan objectives.",
    primary: { name: "Counsel Patricia Miera", role: "Deputy City Attorney", email: "pmiera@cabq.gov", phone: "505-555-2201" },
    planItems: [plan(8, 0, 0, 0)],
  },
  {
    dept: "Legal",
    title: "Nuisance Property Abatement Task Force",
    details: "Establish an interdepartmental task force to streamline the nuisance property abatement process. Combines code enforcement, legal, and planning resources to address chronic problem properties through coordinated legal and administrative actions.",
    howFurthers: "Supports distinct community character by addressing blighted properties, enhances neighborhood safety and identity, and improves interagency coordination.",
    primary: { name: "Attorney David Griego", role: "Code Enforcement Counsel", email: "dgriego@cabq.gov", phone: "505-555-2202" },
    planItems: [plan(0, 0, 0, 0), plan(0, 0, 0, 1)],
  },

  // ── Office of Emergency Management ──
  {
    dept: "Office of Emergency Management",
    title: "Community Emergency Preparedness Hub Network",
    details: "Establish 10 community emergency preparedness hubs at existing community centers and libraries. Each hub will maintain emergency supply caches, serve as communication relay points during disasters, and host quarterly preparedness training workshops.",
    howFurthers: "Strengthens community resilience infrastructure, leverages existing community facilities for emergency preparedness, and promotes neighborhood-level disaster readiness.",
    primary: { name: "Director Alex Romero", role: "OEM Director", email: "aromero@cabq.gov", phone: "505-555-2301" },
    planItems: [plan(8, 1, 0, 1), plan(9, 0, 0, 2)],
  },
  {
    dept: "Office of Emergency Management",
    title: "Flood Warning System Modernization",
    details: "Upgrade the metropolitan flood warning system with 30 new automated rain gauges, enhanced arroyo flow sensors, and real-time SMS/app-based alerts for residents in flood-prone areas. Integrates with the National Weather Service Advanced Hydrologic Prediction Service.",
    howFurthers: "Improves climate resilience through modern monitoring infrastructure, protects life and property in flood-vulnerable areas, and supports water management objectives.",
    primary: { name: "Sarah Candelaria", role: "Flood Control Officer", email: "scandelaria@cabq.gov", phone: "505-555-2302" },
    planItems: [plan(9, 1, 0, 2)],
  },

  // ── Human Resources ──
  {
    dept: "Human Resources",
    title: "Workforce Diversity and Recruitment Strategy",
    details: "Develop a comprehensive workforce diversity strategy including targeted recruitment pipelines with local universities and trade schools, paid internship programs for underrepresented communities, mentorship programs, and annual diversity benchmarking reports.",
    howFurthers: "Promotes inclusive workforce development, supports diverse talent pipelines aligned with equity goals, and strengthens city capacity to serve diverse communities.",
    primary: { name: "Janet Lucero", role: "HR Director", email: "jlucero@cabq.gov", phone: "505-555-2401" },
    planItems: [plan(4, 1, 0, 1)],
  },

  // ── City Clerk ──
  {
    dept: "City Clerk",
    title: "Public Records Digital Archive Project",
    details: "Digitize 50 years of city council proceedings, ordinances, resolutions, and meeting minutes into a searchable online archive. Includes OCR processing, metadata tagging, and integration with the city's document management system.",
    howFurthers: "Improves public access to government records, supports transparency and community engagement, and preserves institutional knowledge through modern archival practices.",
    primary: { name: "Clerk Rebecca Torres", role: "City Clerk", email: "rtorres@cabq.gov", phone: "505-555-2501" },
    planItems: [plan(8, 0, 0, 0)],
  },
];

export function seedTestData(): number {
  if (typeof localStorage === "undefined") return 0;

  const existing = localStorage.getItem(SAVED_ACTIONS_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as unknown[];
      if (Array.isArray(parsed) && parsed.length > 10) return 0;
    } catch { /* continue to seed */ }
  }

  const actions: SavedAction[] = records.map((r, idx) => {
    const created = daysAgo(90 - idx * 2 + Math.floor(Math.random() * 5));
    const updated = daysAgo(Math.max(0, 30 - idx + Math.floor(Math.random() * 10)));
    const snapshot: DraftSnapshot = {
      planItems: r.planItems,
      actionTitle: r.title,
      actionDetails: `<p>${r.details}</p>`,
      howFurthersPolicies: r.howFurthers,
      department: r.dept,
      primaryContact: r.primary,
      alternateContact: r.alternate ?? emptyContact(),
    };
    return {
      id: nextId(),
      cpRecordId: `CP-${String(idx + 1).padStart(6, "0")}`,
      createdAt: created,
      updatedAt: updated,
      snapshot,
    };
  });

  localStorage.setItem(SAVED_ACTIONS_KEY, JSON.stringify(actions));
  return actions.length;
}
