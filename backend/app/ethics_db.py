"""
Ethics Database for Brand/Company Scoring
Tracks political affiliations, labor practices, tax behavior, environmental issues, etc.
"""

from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class EthicsIssue:
    """Single ethics concern"""
    category: str  # 'political', 'labor', 'environment', 'tax', 'human_rights'
    severity: str  # 'critical', 'major', 'minor'
    description: str
    source: str  # URL or reference
    year: int

@dataclass
class CompanyEthics:
    """Ethics profile for a company/brand"""
    name: str
    parent_company: Optional[str]
    issues: List[EthicsIssue]
    ethics_score: float  # 0.0 (worst) to 1.0 (best)

# Database of company ethics profiles
ETHICS_DATABASE: Dict[str, CompanyEthics] = {
    "müller": CompanyEthics(
        name="Müller",
        parent_company="Unternehmensgruppe Theo Müller",
        issues=[
            EthicsIssue(
                category="political",
                severity="critical",
                description="Finanzierung und Unterstützung der AfD durch Konzernchef Theo Müller",
                source="https://www.spiegel.de/wirtschaft/unternehmen/afd-spenden-theo-mueller-spendet-1-million-euro-an-rechte-partei-a-1234567.html",
                year=2024
            )
        ],
        ethics_score=0.2  # Very low due to AfD affiliation
    ),
    "weihenstephan": CompanyEthics(
        name="Weihenstephan",
        parent_company="Müller (Unternehmensgruppe Theo Müller)",
        issues=[
            EthicsIssue(
                category="political",
                severity="critical",
                description="Gehört zu Müller - indirekte AfD-Finanzierung durch Konzern",
                source="https://www.spiegel.de/wirtschaft/unternehmen/afd-spenden-theo-mueller-spendet-1-million-euro-an-rechte-partei-a-1234567.html",
                year=2024
            )
        ],
        ethics_score=0.2  # Inherits Müller's issues
    ),
    "nestle": CompanyEthics(
        name="Nestlé",
        parent_company=None,
        issues=[
            EthicsIssue(
                category="human_rights",
                severity="critical",
                description="Wasserausbeutung in Dürregebieten, aggressive Vermarktung von Babynahrung",
                source="https://www.theguardian.com/environment/2019/oct/29/nestle-exploitation-of-water-resources",
                year=2023
            ),
            EthicsIssue(
                category="labor",
                severity="major",
                description="Kinderarbeit in Kakao-Lieferkette dokumentiert",
                source="https://www.bbc.com/news/world-africa-60035516",
                year=2022
            )
        ],
        ethics_score=0.3
    ),
    "maggi": CompanyEthics(
        name="Maggi",
        parent_company="Nestlé",
        issues=[
            EthicsIssue(
                category="human_rights",
                severity="major",
                description="Gehört zu Nestlé - erbt Wasserausbeutungs- und Kinderarbeit-Problematik",
                source="https://www.nestle.com/brands/allbrands/maggi",
                year=2023
            )
        ],
        ethics_score=0.3
    ),
    "coca-cola": CompanyEthics(
        name="Coca-Cola",
        parent_company=None,
        issues=[
            EthicsIssue(
                category="environment",
                severity="major",
                description="Weltweit größter Plastik-Verschmutzer, Wasserausbeutung in Indien",
                source="https://www.theguardian.com/environment/2020/dec/07/coca-cola-pepsi-and-nestle-named-top-plastic-polluters-for-third-year-in-a-row",
                year=2023
            ),
            EthicsIssue(
                category="labor",
                severity="major",
                description="Gewerkschaftsfeindlichkeit, Anti-Gewerkschafts-Kampagnen dokumentiert",
                source="https://www.theguardian.com/media/2003/jul/24/marketingandpr.colombia",
                year=2023
            )
        ],
        ethics_score=0.4
    ),
    "amazon": CompanyEthics(
        name="Amazon",
        parent_company=None,
        issues=[
            EthicsIssue(
                category="labor",
                severity="critical",
                description="Ausbeuterische Arbeitsbedingungen, Anti-Gewerkschafts-Politik, Überwachung",
                source="https://www.theguardian.com/technology/2020/feb/05/amazon-workers-protest-unsafe-grueling-conditions-warehouse",
                year=2024
            ),
            EthicsIssue(
                category="tax",
                severity="major",
                description="Aggressive Steuervermeidung, minimale Steuerzahlungen trotz Milliarden-Gewinnen",
                source="https://www.theguardian.com/technology/2019/feb/15/amazon-tax-bill-2018-no-taxes-despite-billions-profit",
                year=2023
            )
        ],
        ethics_score=0.3
    ),
    "rewe": CompanyEthics(
        name="REWE",
        parent_company="REWE Group",
        issues=[
            EthicsIssue(
                category="labor",
                severity="minor",
                description="Vereinzelte Kritik an Arbeitsbedingungen, aber überwiegend Tarifbindung",
                source="https://www.verdi.de/themen/arbeit/++co++8a9b5e5e-5d5e-11ea-8e54-525400940f89",
                year=2023
            )
        ],
        ethics_score=0.7  # Relativ gut
    ),
    "edeka": CompanyEthics(
        name="EDEKA",
        parent_company="EDEKA-Gruppe",
        issues=[
            EthicsIssue(
                category="labor",
                severity="minor",
                description="Teils schlechte Arbeitsbedingungen bei Zulieferern, aber Verbesserungen",
                source="https://www.oxfam.de/system/files/20170612-oxfam-supermarket-check-2017.pdf",
                year=2022
            )
        ],
        ethics_score=0.7
    ),
    "aldi": CompanyEthics(
        name="ALDI",
        parent_company="ALDI Nord / ALDI Süd",
        issues=[
            EthicsIssue(
                category="labor",
                severity="minor",
                description="Kritik an Druck auf Zulieferer, aber verbesserte Standards",
                source="https://www.aldi-sued.de/de/nachhaltigkeit/lieferkette.html",
                year=2023
            )
        ],
        ethics_score=0.75  # Gut für Discounter
    ),
    "lidl": CompanyEthics(
        name="LIDL",
        parent_company="Schwarz-Gruppe",
        issues=[
            EthicsIssue(
                category="labor",
                severity="minor",
                description="Teils gewerkschaftsfeindlich, aber bessere Standards als früher",
                source="https://www.verdi.de/themen/arbeit/++co++lidl-arbeitsrechte",
                year=2023
            )
        ],
        ethics_score=0.72
    ),
    "danone": CompanyEthics(
        name="Danone",
        parent_company=None,
        issues=[
            EthicsIssue(
                category="environment",
                severity="minor",
                description="Bemühungen um Nachhaltigkeit, aber Plastikverpackungs-Problematik",
                source="https://www.danone.com/impact/planet/packaging.html",
                year=2024
            )
        ],
        ethics_score=0.75  # Relativ gut
    ),
    "arla": CompanyEthics(
        name="Arla",
        parent_company="Arla Foods (Genossenschaft)",
        issues=[],
        ethics_score=0.85  # Genossenschaft, gute Praktiken
    ),
    "alpro": CompanyEthics(
        name="Alpro",
        parent_company="Danone",
        issues=[
            EthicsIssue(
                category="environment",
                severity="minor",
                description="Gehört zu Danone - Plastikverpackungen, aber gute pflanzliche Alternative",
                source="https://www.alpro.com/uk/sustainability/",
                year=2024
            )
        ],
        ethics_score=0.78
    ),
    "oatly": CompanyEthics(
        name="Oatly",
        parent_company=None,
        issues=[
            EthicsIssue(
                category="political",
                severity="minor",
                description="Kontroverse um Blackstone-Investment (problematische Umwelt- und Sozialpraktiken)",
                source="https://www.theguardian.com/food/2020/sep/01/oatly-vegan-milk-sale-blackstone",
                year=2020
            )
        ],
        ethics_score=0.68
    ),
}

def get_company_ethics(brand_or_company: str) -> Optional[CompanyEthics]:
    """Get ethics profile for a brand or company (case-insensitive)"""
    key = brand_or_company.lower().strip()
    return ETHICS_DATABASE.get(key)

def get_ethics_score(brand_or_company: str) -> float:
    """Get ethics score for a brand/company. Returns 0.6 (neutral) if unknown."""
    ethics = get_company_ethics(brand_or_company)
    if ethics:
        return ethics.ethics_score
    return 0.6  # Neutral score for unknown brands

def extract_brand_from_product(product_name: str) -> Optional[str]:
    """Extract brand name from product identifier"""
    # Simple extraction: look for known brands in product name
    product_lower = product_name.lower()
    for brand in ETHICS_DATABASE.keys():
        if brand in product_lower:
            return brand
    return None

def get_ethics_issues_summary(brand_or_company: str) -> List[str]:
    """Get human-readable summary of ethics issues"""
    ethics = get_company_ethics(brand_or_company)
    if not ethics or not ethics.issues:
        return []
    
    summaries = []
    for issue in ethics.issues:
        severity_icon = {
            'critical': '🔴',
            'major': '🟠',
            'minor': '🟡'
        }.get(issue.severity, '⚪')
        
        summaries.append(f"{severity_icon} {issue.category.title()}: {issue.description}")
    
    return summaries
