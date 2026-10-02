// Exact cloudcast names that must remain unparsed and be reported as failures.
// Check this list before running any parser.
export const excludedShowNames = new Set([
	"Looking Glass with Lodi Dottie Episode 7, August 3, 2026",
	"Looking Glass with Lodi Dottie Episode 6:  Heart of the Mojave and beyond ♡, February 23, 2025",
	"Looking Glass with Lodi Dottie Episode 5: Discoween Special, October 28, 2024",
	"Looking Glass with Lodi Dottie Episode 4, August 26, 2024",
	"Looking Glass with Lodi Dottie Episode 3, April 15, 2023",
	"Looking Glass with Lodi Dottie Episode 2, October 2, 2023",
	"Looking Glass with Lodi Dottie Episode 1, August 7, 2023",
	"K Sera Sarah's Beyond Karaoke Episode 12 - Free Will or Free Won't",
]);

// Exact parsed DJ names can be renamed to one DJ or split into multiple DJs.
export const manualDJOverrides = new Map<string, string | string[]>([
	["Caroline + Ethan", ["Caroline", "Ethan"]],
	["Caroline and Ethan", ["Caroline", "Ethan"]],
	["Ethan and Caroline", ["Caroline", "Ethan"]],
	["Tara Jane O'Neil (TJO)", "Tara Jane O'Neil"],
	["Lodi Dottie X Muzizmu", ["Lodi Dottie", "Muzizmu"]],
	["Modular Monday (prepared by Caroline)", "Modular Monday"],
	[
		"Pequeña Cretina + Axaxaxas Mlö (Justin Paszul)",
		["Pequeña Cretina", "Justin Paszul"],
	],

	["HQ Pequeña Cretina", "Pequeña Cretina"],
	["K Serah Sarah", "K Sera Sarah"],
	["Lodi Dottie X Peacetime Product B2B", ["Lodi Dottie", "Peacetime Product"]],
	["Nazmi + Caroline", ["Nazmi", "Caroline"]],
	["Nathan Ober aka DJ NASTY NATE", "Nathan Ober"],
	["Peacetime Product X Lodi Dottie B2B", ["Peacetime Product", "Lodi Dottie"]],
	[
		"John Zoon (hans f wagner) and General Baby (jon nielson)",
		["Hans F. Wagner", "Jon Nielson"],
	],
]);
