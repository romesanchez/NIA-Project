export type DeviceType =
  | "PC" | "SERVER" | "SWITCH" | "ROUTER" | "PRINTER" | "AP"
  | "WEBCAM" | "LAPTOP" | "SMARTPHONE" | "MEDIACONVERTER" | "CONTROLLER";

export interface Department {
  acronym: string;
  name: string;
  description: string;
  devices: Partial<Record<DeviceType, number>>;
  topologyImage?: string;
  filePath: string;
}

export interface DepartmentGroup {
  id: string;
  label: string;
  departments: Department[];
}

export const GROUPS: DepartmentGroup[] = [
  {
    id: "ro1",
    label: "Regional Office 1",
    departments: [
      {
        acronym: "REG-1",
        name: "Regional Office 1",
        description: "The outer boundary of the whole floor plan — every office below (IT, Admin, Atty, Cashier's, Finance, Legislative) hangs off this one building block.",
        devices: {  },
        topologyImage: "/topology/ro1/REG-1.png",
        filePath: "/topology/ro1/reg-1.svg",
      },
      {
        acronym: "IT",
        name: "IT Department (2nd Floor)",
        description: "Home base of the network — five staff PCs run into Switch 1 and Switch 3, right beside Server0, the machine everything else on the floor ultimately reports to.",
        devices: { SERVER: 1, SWITCH: 3, PC: 5, AP: 2 },
        topologyImage: "/topology/ro1/IT.png",
        filePath: "/topology/ro1/it.svg",
      },
      {
        acronym: "ADMIN",
        name: "Admin Office (2nd Floor)",
        description: "PC16 to PC19 sit on a 2950-24 switch shared with Storage, feeding upstream into the core switch stack.",
        devices: { SWITCH: 1, PC: 4 },
        topologyImage: "/topology/ro1/ADMIN.png",
        filePath: "/topology/ro1/admin.svg",
      },
      {
        acronym: "ATTY",
        name: "Atty",
        description: "A small two-PC node (PC21, PC22) on its own 2950-24 switch, kept just off the Admin Office cluster.",
        devices: { SWITCH: 1, PC: 2 },
        topologyImage: "/topology/ro1/ATTY.png",
        filePath: "/topology/ro1/atty.svg",
      },
      {
        acronym: "CASHIER",
        name: "Cashier's Office (1st Floor)",
        description: "PC23 to PC26 plus a printer and a webcam (IoT12) run on a dedicated 2950-24 switch — camera coverage built right into the cash-handling area.",
        devices: { SWITCH: 1, PC: 4, PRINTER: 1, WEBCAM: 1 },
        topologyImage: "/topology/ro1/CASHIER.png",
        filePath: "/topology/ro1/cashier.svg",
      },
      {
        acronym: "FINANCE",
        name: "Finance Office (1st Floor)",
        description: "The largest office node on the floor — PC31 through PC43 and four printers all converge on one switch, with a webcam watching the room.",
        devices: { SWITCH: 1, PC: 13, PRINTER: 4, WEBCAM: 1 },
        topologyImage: "/topology/ro1/FINANCE.png",
        filePath: "/topology/ro1/finance.svg",
      },
      {
        acronym: "LEGIS",
        name: "Legislative",
        description: "Connects through a 2950-24 switch alongside Old PR, uplinked via a PT8200 router back to the core.",
        devices: { SWITCH: 1, ROUTER: 1 },
        topologyImage: "/topology/ro1/LEGIS.png",
        filePath: "/topology/ro1/legis.svg",
      },
      {
        acronym: "STORAGE",
        name: "Storage",
        description: "Shares Admin Office's switch — no dedicated endpoint of its own, just port capacity reserved on the same 2950-24.",
        devices: { SWITCH: 1 },
        topologyImage: "/topology/ro1/STORAGE.png",
        filePath: "/topology/ro1/storage.svg",
      },
      {
        acronym: "OLD-PR",
        name: "Old PR",
        description: "Sits beside Legislative on the same PT8200 router link, one of the smaller legacy nodes on the regional office floor.",
        devices: { ROUTER: 1 },
        topologyImage: "/topology/ro1/OLD-PR.png",
        filePath: "/topology/ro1/old-pr.svg",
      },
      {
        acronym: "PPU",
        name: "Property and Procurement Unit",
        description: "PC7 to PC9 and two printers (Printer11, Printer11(1)) all run off Switch17 — a compact single-switch node handling the office's procurement and property records.",
        devices: { SWITCH: 1, PC: 3, PRINTER: 2 },
        topologyImage: "/topology/ro1/PPU.png",
        filePath: "/topology/ro1/ppu.svg",
      },
    ],
  },
  {
    id: "eod",
    label: "EOD / CMS Complex",
    departments: [
      {
        acronym: "EOD-BLDG",
        name: "EOD Building",
        description: "The building shell that everything on the west side of the diagram — RMI, Boss Office, PDS, and EOD 1st Floor — physically sits inside.",
        devices: {  },
        topologyImage: "/topology/eod/EOD-BLDG.png",
        filePath: "/topology/eod/eod-bldg.svg",
      },
      {
        acronym: "RMI",
        name: "RMI (1st Floor)",
        description: "Router2(1) links a laptop, a printer, and a smartphone through the media converter into Switch14 — the entry point into the wider EOD network.",
        devices: { ROUTER: 1, SWITCH: 1, MEDIACONVERTER: 1, LAPTOP: 1, PRINTER: 1, SMARTPHONE: 1 },
        topologyImage: "/topology/eod/RMI.png",
        filePath: "/topology/eod/rmi.svg",
      },
      {
        acronym: "BOSS",
        name: "Boss Office",
        description: "Two PCs (PC45, PC46) run off Router1, sitting between RMI and the PDS uplink.",
        devices: { ROUTER: 1, PC: 2 },
        topologyImage: "/topology/eod/BOSS.png",
        filePath: "/topology/eod/boss.svg",
      },
      {
        acronym: "PDS",
        name: "PDS (2nd Floor)",
        description: "Router1 branches down to a cluster of PCs (PC83–PC92) on Switch16, one of the deeper nodes off the media converter.",
        devices: { ROUTER: 1, SWITCH: 1, PC: 10 },
        topologyImage: "/topology/eod/PDS.png",
        filePath: "/topology/eod/pds.svg",
      },
      {
        acronym: "CMS",
        name: "CMS",
        description: "The building on the east side — Router13 and Router14 fan out to Switch12 and Switch13, feeding PIMO, LUIMO, ISIMO, INIMO, RIO, and the CMS Ground Floor beneath it.",
        devices: { ROUTER: 2, SWITCH: 2 },
        topologyImage: "/topology/eod/CMS.png",
        filePath: "/topology/eod/cms.svg",
      },
      {
        acronym: "PIMO",
        name: "PIMO",
        description: "A PT8200 router paired with one laptop — the first of five near-identical office nodes lined up under CMS.",
        devices: { ROUTER: 1, LAPTOP: 1 },
        topologyImage: "/topology/eod/PIMO.png",
        filePath: "/topology/eod/pimo.svg",
      },
      {
        acronym: "LUIMO",
        name: "LUIMO",
        description: "Same pattern as PIMO — one router, one laptop, its own drop straight to CMS Ground Floor's switch fabric.",
        devices: { ROUTER: 1, LAPTOP: 1 },
        topologyImage: "/topology/eod/LUIMO.png",
        filePath: "/topology/eod/luimo.svg",
      },
      {
        acronym: "ISIMO",
        name: "ISIMO",
        description: "Third in the PIMO–RIO row, a single router-and-laptop office node under the CMS building.",
        devices: { ROUTER: 1, LAPTOP: 1 },
        topologyImage: "/topology/eod/ISIMO.png",
        filePath: "/topology/eod/isimo.svg",
      },
      {
        acronym: "INIMO",
        name: "INIMO",
        description: "Fourth office in the row, mirroring PIMO, LUIMO, and ISIMO on its own PT8200 router.",
        devices: { ROUTER: 1, LAPTOP: 1 },
        topologyImage: "/topology/eod/INIMO.png",
        filePath: "/topology/eod/inimo.svg",
      },
      {
        acronym: "RIO",
        name: "RIO",
        description: "Closes out the row of five CMS offices, sitting right above CMS Ground Floor's router.",
        devices: { ROUTER: 1 },
        topologyImage: "/topology/eod/RIO.png",
        filePath: "/topology/eod/rio.svg",
      },
      {
        acronym: "CMS-GF",
        name: "CMS Ground Floor",
        description: "Where PIMO through RIO all land — PC53 to PC55, a laptop, and a smartphone share the ground-floor router.",
        devices: { ROUTER: 1, PC: 3, LAPTOP: 1, SMARTPHONE: 1 },
        topologyImage: "/topology/eod/CMS-GF.png",
        filePath: "/topology/eod/cms-gf.svg",
      },
      {
        acronym: "EOD-1F",
        name: "EOD (1st Floor)",
        description: "A dense cluster of PCs and two printers on Switch9, watched over by Webcam IoT5 — the busiest single switch on this side of the map.",
        devices: { SWITCH: 1, PC: 8, PRINTER: 2, WEBCAM: 1 },
        topologyImage: "/topology/eod/EOD-1F.png",
        filePath: "/topology/eod/eod-1f.svg",
      },
      {
        acronym: "OS",
        name: "OS",
        description: "Shares the EOD 1st Floor switch fabric — a small office tucked next to EMS on the same run.",
        devices: { PC: 2 },
        topologyImage: "/topology/eod/OS.png",
        filePath: "/topology/eod/os.svg",
      },
      {
        acronym: "EMS",
        name: "EMS",
        description: "Sits alongside OS off the same Switch9 cluster on the EOD ground floor.",
        devices: { PC: 2 },
        topologyImage: "/topology/eod/EMS.png",
        filePath: "/topology/eod/ems.svg",
      },
    ],
  },
  {
    id: "rtc",
    label: "RTC Network Room",
    departments: [
      {
        acronym: "RTC",
        name: "RTC",
        description: "The core of this building — a NetworkController, Switch18, and a 3560-24PS multilayer switch anchor everything below it, including Lobby and the 2nd Floor Office.",
        devices: { CONTROLLER: 1, SWITCH: 2 },
        topologyImage: "/topology/rtc/RTC.png",
        filePath: "/topology/rtc/rtc.svg",
      },
      {
        acronym: "NET-RM",
        name: "Network Room",
        description: "Houses the multilayer switch and Router10 — the highest point in this building's topology, everything downstream traces back here.",
        devices: { SWITCH: 1, ROUTER: 1 },
        topologyImage: "/topology/rtc/NET-RM.png",
        filePath: "/topology/rtc/net-rm.svg",
      },
      {
        acronym: "LOBBY",
        name: "Lobby",
        description: "A single PC (PC108) and Webcam IoT4 run off Router15, the first stop below the network room's core switch.",
        devices: { ROUTER: 1, PC: 1, WEBCAM: 1 },
        topologyImage: "/topology/rtc/LOBBY.png",
        filePath: "/topology/rtc/lobby.svg",
      },
      {
        acronym: "2F-OFC",
        name: "2nd Floor Office",
        description: "Switch19 fans out to three PCs, two printers, and Webcam IoT8, with Routers 16, 18, and 19 carrying the link further out.",
        devices: { SWITCH: 1, ROUTER: 3, PC: 3, PRINTER: 2, WEBCAM: 1 },
        topologyImage: "/topology/rtc/2F-OFC.png",
        filePath: "/topology/rtc/2f-ofc.svg",
      },
    ],
  },
];

export const ALL_DEPARTMENTS: Array<Department & { groupId: string; groupLabel: string; index: number }> = GROUPS.flatMap(
  (g) => g.departments.map((d) => ({ ...d, groupId: g.id, groupLabel: g.label })),
).map((d, i) => ({ ...d, index: i }));

export const TOTAL = ALL_DEPARTMENTS.length;
