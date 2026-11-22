# XYZ Molecule Visualizer

This web app visualizes the molecule data in XYZ files.
I designed it for inspecting the inputs and outpus of machine learning interatomic potentials (MLIPs) such as [MACE](https://github.com/ACEsuit/mace).

## Features

- **Support non-Extended and Extended XYZ files**. Their file names usually end with `.xyz` or `.extxyz`.
- **Support multiple frames.** An XYZ file can contain multiple molecule images called _frames_.
- **Visualize the molecules in 3D.** You can move the camera with your mouse. The 3D rendering is powered by [Three.js](https://github.com/mrdoob/three.js)!
- **Visualize the force vectors for each atom,** if their data is present in the XYZ file.
- **Display the energy for each molecule,** if its data is present in the XYZ file. Note: an XYZ file does not tell the units for the energy and what _energy = 0_ is; this app just displays the value present in the file.

## Development

This is a hobby project of mine I began from scratch.
I started working on this project on 2026-11-12.

I did not use generative AI for this project.
