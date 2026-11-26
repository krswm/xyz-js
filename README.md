# XYZ Molecule Visualizer

This web app visualizes the molecule data in XYZ files.
I designed it for inspecting the inputs and outpus of machine learning interatomic potentials (MLIPs) such as [MACE](https://github.com/ACEsuit/mace).

## Features

- **Support non-Extended and Extended XYZ files**. Their file names usually end with `.xyz` or `.extxyz`.
- **Support multiple frames.** An XYZ file can contain multiple molecule images called _frames_.
- **Visualize the molecules in 3D.** Visualize the lattice areas if their data is present in the XYZ file. You can move the perspective with your mouse. The 3D rendering is powered by [Three.js](https://github.com/mrdoob/three.js)!
- **Visualize the force vectors for each atom,** if their data is present in the XYZ file.
- **Display the energy for each molecule,** if its data is present in the XYZ file. An XYZ file does not tell the units of energy and what _energy = 0_ is. This app just displays the value present in the file.

## Development

This project is free and open source!
[MIT License](LICENSE.txt).

This is a hobby project of mine I began from scratch.
I started working on this project on 2026-11-12.

By working on this project, I learned some programming concepts!
Namely: JavaScript modules and the Three.js API.

I did not use generative AI for this project.
