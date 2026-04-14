import json
import math
from pathlib import Path


KAPPA = 0.41
CMU = 0.09
EPSILON_WALL_E = 9.8
ABL_DEFAULT_K_AMBIENT = 1.0e-4
ABL_DEFAULT_EPSILON_AMBIENT = 7.208e-08
ABL_LENGTH_SCALE_LIMIT_FACTOR = 1.0 / 3.0
LEGACY_FIXED_K = 0.5
LEGACY_FIXED_EPSILON = 0.375


def fmt_scalar(value):
    return f"{float(value):.10g}"


def fmt_vector(x, y, z):
    return f"({fmt_scalar(x)} {fmt_scalar(y)} {fmt_scalar(z)})"


def foam_header(class_name, object_name, location="0"):
    return f"""/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  v2212                                 |
|   \\\\  /    A nd           | Website:  www.openfoam.com                      |
|    \\\\/     M anipulation  |                                                 |
\\*---------------------------------------------------------------------------*/
FoamFile
{{
    version     2.0;
    format      ascii;
    class       {class_name};
    location    "{location}";
    object      {object_name};
}}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
"""


def load_info():
    info_path = Path("../info.json")
    with info_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def pick_first(mapping, *keys, default=None):
    for key in keys:
        if key in mapping and mapping[key] is not None:
            return mapping[key]
    return default


def ensure_positive(name, value, allow_zero=False):
    numeric = float(value)
    if allow_zero:
        if numeric < 0:
            raise ValueError(f"{name} must be >= 0, got {numeric}")
    elif numeric <= 0:
        raise ValueError(f"{name} must be > 0, got {numeric}")
    return numeric


def compute_uniform_turbulence(speed, intensity, length_scale):
    k = 1.5 * (speed * intensity) ** 2
    epsilon = 0.0
    if k > 0 and length_scale > 0:
        epsilon = (CMU ** 0.75) * (k ** 1.5) / length_scale
    return k, epsilon


def compute_abl_reference(speed, z_ref, z0, displacement):
    effective_height = z_ref - displacement + z0
    if effective_height <= z0:
        raise ValueError(
            "ABL reference height must satisfy referenceHeight - displacementHeight + roughnessLength > roughnessLength"
        )

    friction_velocity = speed * KAPPA / math.log(effective_height / z0)
    k_ref = (friction_velocity ** 2) / math.sqrt(CMU)
    epsilon_ref = (friction_velocity ** 3) / (KAPPA * effective_height)
    tau = friction_velocity ** 2
    return friction_velocity, k_ref, epsilon_ref, tau


def build_uniform_u(speed):
    return (
        foam_header("volVectorField", "U")
        + f"""
dimensions      [0 1 -1 0 0 0 0];

internalField   uniform {fmt_vector(speed, 0.0, 0.0)};

boundaryField
{{
    inlet
    {{
        type            fixedValue;
        value           uniform {fmt_vector(speed, 0.0, 0.0)};
    }}

    outlet
    {{
        type            zeroGradient;
    }}

    front
    {{
        type            symmetry;
    }}

    back
    {{
        type            symmetry;
    }}

    bot
    {{
        type            noSlip;
    }}

    top
    {{
        type            symmetry;
    }}
}}

// ************************************************************************* //
"""
    )


def build_uniform_k(k_inlet):
    return (
        foam_header("volScalarField", "k")
        + f"""
kInlet          {fmt_scalar(k_inlet)};

dimensions      [0 2 -2 0 0 0 0];

internalField   uniform $kInlet;

boundaryField
{{
    inlet
    {{
        type            fixedValue;
        value           uniform $kInlet;
    }}

    outlet
    {{
        type            inletOutlet;
        inletValue      uniform $kInlet;
        value           $internalField;
    }}

    front
    {{
        type            symmetry;
    }}

    back
    {{
        type            symmetry;
    }}

    bot
    {{
        type            kqRWallFunction;
        value           uniform 0;
    }}

    top
    {{
        type            symmetry;
    }}
}}

// ************************************************************************* //
"""
    )


def build_uniform_epsilon(epsilon_inlet):
    return (
        foam_header("volScalarField", "epsilon")
        + f"""
epsilonInlet    {fmt_scalar(epsilon_inlet)};

dimensions      [0 2 -3 0 0 0 0];

internalField   uniform $epsilonInlet;

boundaryField
{{
    inlet
    {{
        type            fixedValue;
        value           uniform $epsilonInlet;
    }}

    outlet
    {{
        type            inletOutlet;
        inletValue      uniform $epsilonInlet;
        value           $internalField;
    }}

    front
    {{
        type            symmetry;
    }}

    back
    {{
        type            symmetry;
    }}

    bot
    {{
        type            epsilonWallFunction;
        value           uniform $epsilonInlet;
    }}

    top
    {{
        type            symmetry;
    }}
}}

// ************************************************************************* //
"""
    )


def build_uniform_nut():
    return (
        foam_header("volScalarField", "nut")
        + """
dimensions      [0 2 -1 0 0 0 0];

internalField   uniform 0;

boundaryField
{
    inlet
    {
        type            calculated;
        value           uniform 0;
    }

    outlet
    {
        type            calculated;
        value           uniform 0;
    }

    front
    {
        type            symmetry;
    }

    back
    {
        type            symmetry;
    }

    bot
    {
        type            nutkWallFunction;
        value           uniform 0;
    }

    top
    {
        type            symmetry;
    }
}

// ************************************************************************* //
"""
    )


def build_abl_conditions(speed, z_ref, z0, displacement):
    return f"""        flowDir         (1 0 0);
        zDir            (0 0 1);
        Uref            {fmt_scalar(speed)};
        Zref            {fmt_scalar(z_ref)};
        z0              uniform {fmt_scalar(z0)};
        d               uniform {fmt_scalar(displacement)};"""


def build_abl_u(speed, z_ref, z0, displacement, tau):
    abl_conditions = build_abl_conditions(speed, z_ref, z0, displacement)
    return (
        foam_header("volVectorField", "U")
        + f"""
dimensions      [0 1 -1 0 0 0 0];

internalField   uniform {fmt_vector(speed, 0.0, 0.0)};

boundaryField
{{
    inlet
    {{
        type            atmBoundaryLayerInletVelocity;
{abl_conditions}
        value           uniform {fmt_vector(0.0, 0.0, 0.0)};
    }}

    outlet
    {{
        type            zeroGradient;
    }}

    front
    {{
        type            symmetry;
    }}

    back
    {{
        type            symmetry;
    }}

    bot
    {{
        type            noSlip;
    }}

    top
    {{
        type            fixedShearStress;
        tau             {fmt_vector(tau, 0.0, 0.0)};
        value           uniform {fmt_vector(0.0, 0.0, 0.0)};
    }}
}}

// ************************************************************************* //
"""
    )


def build_abl_k(speed, z_ref, z0, displacement, k_ref):
    abl_conditions = build_abl_conditions(speed, z_ref, z0, displacement)
    return (
        foam_header("volScalarField", "k")
        + f"""
dimensions      [0 2 -2 0 0 0 0];

internalField   uniform {fmt_scalar(k_ref)};

boundaryField
{{
    inlet
    {{
        type            atmBoundaryLayerInletK;
{abl_conditions}
        value           uniform {fmt_scalar(k_ref)};
    }}

    outlet
    {{
        type            inletOutlet;
        inletValue      uniform {fmt_scalar(k_ref)};
        value           $internalField;
    }}

    front
    {{
        type            symmetry;
    }}

    back
    {{
        type            symmetry;
    }}

    bot
    {{
        type            kqRWallFunction;
        value           uniform 0;
    }}

    top
    {{
        type            zeroGradient;
    }}
}}

// ************************************************************************* //
"""
    )


def build_abl_epsilon(speed, z_ref, z0, displacement, epsilon_ref):
    abl_conditions = build_abl_conditions(speed, z_ref, z0, displacement)
    return (
        foam_header("volScalarField", "epsilon")
        + f"""
dimensions      [0 2 -3 0 0 0 0];

internalField   uniform {fmt_scalar(epsilon_ref)};

boundaryField
{{
    inlet
    {{
        type            atmBoundaryLayerInletEpsilon;
{abl_conditions}
        value           uniform {fmt_scalar(epsilon_ref)};
    }}

    outlet
    {{
        type            inletOutlet;
        inletValue      uniform {fmt_scalar(epsilon_ref)};
        value           $internalField;
    }}

    front
    {{
        type            symmetry;
    }}

    back
    {{
        type            symmetry;
    }}

    bot
    {{
        type            epsilonWallFunction;
        Cmu             {fmt_scalar(CMU)};
        kappa           {fmt_scalar(KAPPA)};
        E               {fmt_scalar(EPSILON_WALL_E)};
        value           $internalField;
    }}

    top
    {{
        type            zeroGradient;
    }}
}}

// ************************************************************************* //
"""
    )


def build_abl_nut(z0):
    return (
        foam_header("volScalarField", "nut")
        + f"""
dimensions      [0 2 -1 0 0 0 0];

internalField   uniform 0;

boundaryField
{{
    inlet
    {{
        type            calculated;
        value           uniform 0;
    }}

    outlet
    {{
        type            calculated;
        value           uniform 0;
    }}

    front
    {{
        type            symmetry;
    }}

    back
    {{
        type            symmetry;
    }}

    bot
    {{
        type            atmNutkWallFunction;
        kappa           {fmt_scalar(KAPPA)};
        Cmu             {fmt_scalar(CMU)};
        z0              uniform {fmt_scalar(z0)};
        value           uniform 0;
    }}

    top
    {{
        type            calculated;
        value           uniform 0;
    }}
}}

// ************************************************************************* //
"""
    )


def build_abl_fv_options(z_ref):
    lmax = max(10.0, float(z_ref) * ABL_LENGTH_SCALE_LIMIT_FACTOR)
    return (
        foam_header("dictionary", "fvOptions", location="constant")
        + f"""
atmAmbientTurbSource1
{{
    type            atmAmbientTurbSource;
    selectionMode   all;
    kAmb            {fmt_scalar(ABL_DEFAULT_K_AMBIENT)};
    epsilonAmb      {fmt_scalar(ABL_DEFAULT_EPSILON_AMBIENT)};
}}

atmLengthScaleTurbSource1
{{
    type            atmLengthScaleTurbSource;
    selectionMode   all;
    Lmax            {fmt_scalar(lmax)};
    n               3;
}}

atmPlantCanopyTurbSource1
{{
    type            atmPlantCanopyTurbSource;
    selectionMode   all;
    Cd              roughCd;
    LAD             roughLAD;
}}

// ************************************************************************* //
"""
    )


def build_uniform_fv_options():
    return (
        foam_header("dictionary", "fvOptions", location="constant")
        + """
atmPlantCanopyTurbSource1
{
    type            atmPlantCanopyTurbSource;
    selectionMode   all;
    Cd              roughCd;
    LAD             roughLAD;
}

// ************************************************************************* //
"""
    )


def write_case_files(u_text, k_text, epsilon_text, nut_text, fv_options_text=None):
    zero_dir = Path("0")
    zero_dir.mkdir(exist_ok=True)
    constant_dir = Path("constant")
    constant_dir.mkdir(exist_ok=True)
    (zero_dir / "U").write_text(u_text, encoding="utf-8")
    (zero_dir / "k").write_text(k_text, encoding="utf-8")
    (zero_dir / "epsilon").write_text(epsilon_text, encoding="utf-8")
    (zero_dir / "nut").write_text(nut_text, encoding="utf-8")

    fv_options_path = constant_dir / "fvOptions"
    if fv_options_text is None:
        if fv_options_path.exists():
            fv_options_path.unlink()
    else:
        fv_options_path.write_text(fv_options_text, encoding="utf-8")


def main():
    info = load_info()
    wind = info.get("wind", {})

    profile_raw = pick_first(wind, "profile", default=None)
    profile = None if profile_raw is None else str(profile_raw).strip().lower()
    speed = ensure_positive("wind.speed", pick_first(wind, "speed", default=10.0))
    has_explicit_uniform_inputs = any(
        wind.get(key) is not None
        for key in ("turbulenceIntensity", "TI", "turbulenceLengthScale", "lengthScale", "L")
    )
    turbulence_intensity = ensure_positive(
        "wind.turbulenceIntensity",
        pick_first(wind, "turbulenceIntensity", "TI", default=0.1),
    )
    turbulence_length_scale = ensure_positive(
        "wind.turbulenceLengthScale",
        pick_first(wind, "turbulenceLengthScale", "lengthScale", "L", default=10.0),
    )

    if profile == "abl_log":
        z_ref = ensure_positive(
            "wind.referenceHeight",
            pick_first(wind, "referenceHeight", "Zref", "zRef", default=120.0),
        )
        z0 = ensure_positive(
            "wind.roughnessLength",
            pick_first(wind, "roughnessLength", "z0", default=0.03),
        )
        displacement = ensure_positive(
            "wind.displacementHeight",
            pick_first(wind, "displacementHeight", "d", default=0.0),
            allow_zero=True,
        )

        friction_velocity, k_ref, epsilon_ref, tau = compute_abl_reference(
            speed, z_ref, z0, displacement
        )
        write_case_files(
            build_abl_u(speed, z_ref, z0, displacement, tau),
            build_abl_k(speed, z_ref, z0, displacement, k_ref),
            build_abl_epsilon(speed, z_ref, z0, displacement, epsilon_ref),
            build_abl_nut(z0),
            build_abl_fv_options(z_ref),
        )
        print(
            "[INFO] Wrote ABL inlet fields:",
            f"Uref={speed}",
            f"Zref={z_ref}",
            f"z0={z0}",
            f"d={displacement}",
            f"u*={friction_velocity:.6f}",
            f"kRef={k_ref:.6f}",
            f"epsilonRef={epsilon_ref:.6f}",
            f"Lmax={max(10.0, float(z_ref) * ABL_LENGTH_SCALE_LIMIT_FACTOR):.6f}",
        )
        return

    if profile in (None, "", "legacy_fixed") and not has_explicit_uniform_inputs:
        write_case_files(
            build_uniform_u(speed),
            build_uniform_k(LEGACY_FIXED_K),
            build_uniform_epsilon(LEGACY_FIXED_EPSILON),
            build_uniform_nut(),
        )
        print(
            "[INFO] Wrote legacy-compatible inlet fields:",
            f"U={speed}",
            f"k={LEGACY_FIXED_K:.6f}",
            f"epsilon={LEGACY_FIXED_EPSILON:.6f}",
        )
        return

    if profile not in (None, "", "uniform"):
        raise ValueError(f"Unsupported wind.profile '{profile}'")

    k_inlet, epsilon_inlet = compute_uniform_turbulence(
        speed, turbulence_intensity, turbulence_length_scale
    )
    write_case_files(
        build_uniform_u(speed),
        build_uniform_k(k_inlet),
        build_uniform_epsilon(epsilon_inlet),
        build_uniform_nut(),
        build_uniform_fv_options(),
    )
    print(
        "[INFO] Wrote uniform inlet fields:",
        f"U={speed}",
        f"TI={turbulence_intensity}",
        f"L={turbulence_length_scale}",
        f"k={k_inlet:.6f}",
        f"epsilon={epsilon_inlet:.6f}",
    )


if __name__ == "__main__":
    main()
