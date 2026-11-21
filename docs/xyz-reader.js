// TODO: Empty file

class Molecule {
  constructor(atoms, energy) {
    this.atoms = atoms;
    this.energy = energy; // Number or `undefined`
  }
}

class Atom {
  constructor(species, pos, forces) {
    this.species = species; // String or `undefined`
    this.pos = pos; // `[x, y, z]` or `undefined`
    this.forces = forces; // `[fx, fy, fz]` or `undefined`
  }
}

export class XyzReader {
  // I referred to this specification of the XYZ and Extended XYZ format:
  // https://www.ovito.org/docs/current/reference/file_formats/input/xyz.html

  constructor(xyzFileContent) {
    console.log("%c%s", "font-family: monospace;", xyzFileContent);

    this.lines = xyzFileContent.split("\n");
    this.lines.pop(); // Remove the blank line at the end.

    this.lineIndex = 0;
  }

  getMolecules() {
    const molecules = [];

    while (this.lineIndex < this.lines.length) {
      molecules.push(this.getNextMolecule());
    }

    console.log(molecules);
    return molecules;
  }

  getNextMolecule() {
    const numAtoms = Number(this.lines[this.lineIndex++]);
    const metadata = this.toMetadata(this.lines[this.lineIndex++]);
    const properties = this.toProperties(metadata);

    const atoms = [];

    for (let i = 0; i < numAtoms; i++) {
      const line = this.lines[this.lineIndex++];

      const isExtendedXyz = properties !== undefined;
      if (isExtendedXyz) {
        atoms.push(this.toAtomExtendedXyz(line, properties));
      } else {
        atoms.push(this.toAtomXyz(line));
      }
    }

    const energy = Number(metadata.energy) || undefined;

    return new Molecule(atoms, energy);
  }

  toMetadata(line) {
    const matches = line.matchAll(
      /("(?:[^"\\]|\\.)*"|[^ ="[\]{}\\]*)=("(?:[^"\\]|\\.)*"|[^ ="[\]{}\\]*)/g,
    );

    const metadata = {};

    for (const match of matches) {
      const key = match[1];
      let value = match[2];

      if (value.startsWith('"')) {
        value = value.slice(1, -1); // Remove the double quote delimiters.
        value = value.replaceAll(/\\(.)/g, "$1"); // De-escape characters.
      }

      metadata[key] = value;
    }

    return metadata;
  }

  toProperties(metadata) {
    const text = metadata["Properties"];
    if (text === undefined) {
      return undefined;
    }

    const splits = text.split(":");

    const properties = [];

    let i = 0;
    while (i < splits.length) {
      const property = {
        name: splits[i++],
        type: splits[i++],
        num: Number(splits[i++]),
      };

      properties.push(property);
    }

    return properties;
  }

  toAtomExtendedXyz(line, properties) {
    const splits = line.split(/\s+/);

    const data = {};

    let splitIndex = 0;
    for (const property of properties) {
      const values = [];

      for (let i = 0; i < property.num; i++) {
        const value = splits[splitIndex++];

        switch (property.type) {
          case "S":
            values.push(value);
            break;
          case "I":
          case "R":
          case "L":
            values.push(Number(value));
            break;
        }
      }

      data[property.name] = values;
    }

    const species = data.species[0];
    const pos = data.pos;
    const forces = data.forces || data.MACE_forces;

    return new Atom(species, pos, forces);
  }

  toAtomXyz(line) {
    const [species, x, y, z] = line.trim().split(/\s+/);
    const pos = [x, y, z];
    const forces = undefined;

    return new Atom(species, pos);
  }
}
