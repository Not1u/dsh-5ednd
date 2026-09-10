param(
  [Parameter(Mandatory = $false)][string]$Path = '',
  [Parameter(Mandatory = $false)][string]$RulesArg = 'rules/dnd5e-srd.json'
)

$ErrorActionPreference = 'Stop'
$rootDir = if ($env:DND5E_ROOT) { $env:DND5E_ROOT } else { 'E:\HarnessTarvern\dnd5e' }

# --- resolve character path ---
if ($Path -eq '') {
  $found = @(Get-ChildItem -Path (Join-Path $rootDir 'characters\*.json') -File)
  if ($found.Count -ne 1) { throw "Specify -Path; found $($found.Count) character files." }
  $Path = $found[0].FullName
} elseif (-not [System.IO.Path]::IsPathRooted($Path)) {
  $Path = Join-Path (Join-Path $rootDir 'characters') $Path
  if (-not $Path.EndsWith('.json')) { $Path = "$Path.json" }
}
if (-not (Test-Path -LiteralPath $Path)) { throw "Character not found: $Path" }

# --- load data ---
$pc = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json
$srdPath = if ([System.IO.Path]::IsPathRooted($RulesArg)) { $RulesArg } else { Join-Path $rootDir $RulesArg }
$srd = Get-Content -Raw -Encoding UTF8 -LiteralPath $srdPath | ConvertFrom-Json

# --- pure-integer floor of (score-10)/2 (no [math] dependency) ---
function Get-Mod([int]$score) {
  return [int][Math]::Floor(($score - 10) / 2.0)
}

# --- proficiency bonus ---
$level = [int]($pc.level)
$pb = $srd.core.proficiencyBonusByLevel[$level - 1]

# --- ability modifiers ---
$mod = @{}
foreach ($ability in $srd.core.abilityOrder) {
  $mod[$ability] = Get-Mod ($pc.abilities.$ability)
}

# --- derived: skill totals ---
$profSkills = @($pc.skillProfs)
$expertSkills = @($pc.skillExpertise)
$skillTotals = [ordered]@{}
foreach ($skill in $srd.core.skillsByAbility.PSObject.Properties.Name) {
  $skillAbility = $srd.core.skillsByAbility.$skill
  $isExpert = $expertSkills -contains $skill
  $isProficient = $profSkills -contains $skill
  if ($isExpert) { $skillTotals[$skill] = ($mod[$skillAbility] + 2 * $pb) }
  elseif ($isProficient) { $skillTotals[$skill] = ($mod[$skillAbility] + $pb) }
  else { $skillTotals[$skill] = $mod[$skillAbility] }
}

# --- derived: save totals ---
$saveProfAbilities = @($pc.savingThrowProfs)
$saveTotals = [ordered]@{}
foreach ($ability in $srd.core.abilityOrder) {
  if ($saveProfAbilities -contains $ability) { $saveTotals[$ability] = ($mod[$ability] + $pb) }
  else { $saveTotals[$ability] = $mod[$ability] }
}

# --- derived: HP max (full first level per class) ---
$totalLevel = 0
$hpBase = 0
foreach ($classEntry in $pc.classes) {
  $classKey = [string]$classEntry.class
  $classData = $srd.classes.$classKey
  if ($null -eq $classData) { throw "Class not in SRD rules seed: $classKey" }
  $classLevel = [int]($classEntry.level)
  $totalLevel += $classLevel
  if ($classLevel -ge 1) { $hpBase += [int]($classData.hitDieBase) }
  if ($classLevel -ge 2) { $hpBase += ([int]($classData.levelUpHitDieAverage)) * ($classLevel - 1) }
}
$derivedMaxHp = $hpBase + ($mod['con'] * $totalLevel)

# --- derived: AC ---
$dexForAc = $mod['dex']
if ($null -ne $pc.armor) {
  $armorKey = [string]$pc.armor.key
  if ($armorKey -eq '' -or $null -eq $srd.armor.$armorKey) { $armorData = $srd.armor.unarmored }
  else { $armorData = $srd.armor.$armorKey }
  if ($null -ne $armorData.dexCap) {
    $capValue = [int]($armorData.dexCap)
    if ($dexForAc -gt $capValue) { $dexForAc = $capValue }
  }
  $armorClass = ([int]($armorData.base) + $dexForAc)
  if ($pc.armor.shield) { $armorClass += [int]($srd.armor.shieldBonus) }
} else {
  $armorClass = 10 + $dexForAc
}

# --- derived: passive perception ---
$passivePerception = 10 + $skillTotals['perception']

# --- referential integrity vs SRD seed ---
$problems = @()
$raceData = @($srd.races) | Where-Object { $_.key -eq $pc.race } | Select-Object -First 1
if ($null -eq $raceData) { $problems += "race not in SRD seed: $($pc.race)" }
$bgData = $null
foreach ($bgProp in $srd.backgrounds.PSObject.Properties) { if ($bgProp.Name -eq $pc.background) { $bgData = $bgProp.Value } }
if ($null -eq $bgData) { $problems += "background not in SRD seed: $($pc.background)" }
foreach ($ceRef in $pc.classes) {
  $ckRef = [string]$ceRef.class
  $cdRef = $srd.classes.$ckRef
  if ($null -eq $cdRef) { $problems += "class not in SRD seed: $ckRef" }
}
if ($null -ne $pc.armor) {
  $akRef = [string]$pc.armor.key
  if ($akRef -ne '' -and $null -eq $srd.armor.$akRef) { $problems += "armor not in SRD seed: $akRef" }
}
foreach ($wkRef in @($pc.weapons)) { if ($null -eq $srd.weapons.$wkRef) { $problems += "weapon not in SRD seed: $wkRef" } }

# --- spellcasting derived (DC / attack / slot summary) ---
$spellLine = ''
if ($null -ne $pc.spellcasting) {
  $castingInfo = $null
  foreach ($ceCast in $pc.classes) {
    $ckCast = [string]$ceCast.class
    $ci = $srd.classes.$ckCast.casting
    if ($null -ne $ci) { $castingInfo = $ci; break }
  }
  if ($null -eq $castingInfo) {
    $problems += 'spellcasting present but no class grants casting at level 1'
  } else {
    $castAbility = [string]$pc.spellcasting.ability
    if ($castAbility -eq '') { $castAbility = [string]$castingInfo.ability }
    $expectedDc = 8 + $pb + $mod[$castAbility]
    $expectedAttack = $pb + $mod[$castAbility]
    if ($null -ne $pc.spellcasting.dc -and [int]($pc.spellcasting.dc) -ne $expectedDc) { $problems += "spell DC mismatch: stored=$($pc.spellcasting.dc) derived=$expectedDc" }
    if ($null -ne $pc.spellcasting.attackBonus -and [int]($pc.spellcasting.attackBonus) -ne $expectedAttack) { $problems += 'spell attack mismatch' }
    $kind = [string]$castingInfo.kind
    $slotDesc = ''
    if ($kind -eq 'pact') {
      $wl = $srd.core.spellSlots.warlock[$level - 1]
      $slotDesc = "pact slots $($wl.slots) x L$($wl.maxLevel)"
    } elseif ($kind -eq 'full' -or $kind -eq 'half') {
      $arr = $srd.core.spellSlots.$kind[$level - 1]
      if ($arr.Count -gt 0) { $slotDesc = 'slots: ' + ($arr -join '/') }
      else { $slotDesc = 'no slots at level 1 (gained later)' }
    }
    $spellLine = "Spell: ability $castAbility  DC $expectedDc  attack +$expectedAttack  ($slotDesc)"
  }
}

# --- compare immutable derived values ---
if ([int]($pc.hp.max) -ne $derivedMaxHp) { $problems += "hp.max mismatch: stored=$($pc.hp.max) derived=$derivedMaxHp" }
if ([int]($pc.hp.current) -gt [int]($pc.hp.max)) { $problems += 'hp.current > hp.max' }
if ([int]($pc.hp.current) -lt 0) { $problems += 'hp.current < 0' }

# --- render ---
Write-Output "File : $Path"
Write-Output "PC   : $($pc.name)  Lv$level  $($pc.race) / $($pc.background)"
Write-Output ('Attr : STR {0}({1:+0;-0;0}) DEX {2}({3:+0;-0;0}) CON {4}({5:+0;-0;0}) INT {6}({7:+0;-0;0}) WIS {8}({9:+0;-0;0}) CHA {10}({11:+0;-0;0})' -f $pc.abilities.str,$mod['str'],$pc.abilities.dex,$mod['dex'],$pc.abilities.con,$mod['con'],$pc.abilities.int,$mod['int'],$pc.abilities.wis,$mod['wis'],$pc.abilities.cha,$mod['cha'])
Write-Output "HP   : $($pc.hp.current)/$($pc.hp.max) (derived max $derivedMaxHp), temp $($pc.hp.temp), HD $($pc.hp.hitDiceTotal)"
Write-Output "AC   : $armorClass   PB +$pb   Passive Perception $passivePerception"
Write-Output ('Saves: STR {0:+0;-0;0}  DEX {1:+0;-0;0}  CON {2:+0;-0;0}  INT {3:+0;-0;0}  WIS {4:+0;-0;0}  CHA {5:+0;-0;0}' -f $saveTotals.str,$saveTotals.dex,$saveTotals.con,$saveTotals.int,$saveTotals.wis,$saveTotals.cha)
Write-Output "Skills proficient: $($profSkills -join ', ')"
if ($spellLine -ne '') { Write-Output $spellLine }

if ($problems.Count -gt 0) {
  Write-Output 'VALIDATION FAILED'
  $problems | ForEach-Object { Write-Output (' - ' + $_) }
  exit 1
}
Write-Output 'VALIDATION PASS'
exit 0
