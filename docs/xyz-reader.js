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

export class XyzReaderError extends Error {}

export class XyzReader {
  // I referred to this specification of the XYZ and Extended XYZ format:
  // https://www.ovito.org/docs/current/reference/file_formats/input/xyz.html

  constructor(fileContent) {
    console.log("%c%s", "font-family: ui-monospace;", fileContent);

    this.lines = fileContent.split(/\n|\r\n/);

    const trailingLine = this.lines.pop();
    if (trailingLine !== "") {
      this.lines.push(trailingLine);
    }

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
    const numAtoms = Number(this.getNextLine());
    if (!(Number.isInteger(numAtoms) && numAtoms >= 0)) {
      throw new XyzReaderError("invalid numAtoms");
    }

    const metadata = this.toMetadata(this.getNextLine());
    const properties = this.toProperties(metadata);

    const atoms = [];
    for (let i = 0; i < numAtoms; i++) {
      const atom = this.toAtom(this.getNextLine(), properties);
      atoms.push(atom);
    }

    const energy =
      metadata.energy === undefined ? undefined : Number(metadata.energy);

    return { atoms, energy };
  }

  getNextLine() {
    if (this.lineIndex == this.lines.length) {
      throw new XyzReaderError("unexpected end of file");
    }
    return this.lines[this.lineIndex++];
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
      // Default to the non-Extended XYZ format.
      return [
        { name: "species", type: "S", numColumns: 1 },
        { name: "pos", type: "R", numColumns: 3 },
      ];
    }

    const splits = text.split(":");

    const properties = [];
    let i = 0;
    while (i < splits.length) {
      const name = splits[i++];
      const type = splits[i++];
      const numColumns = Number(splits[i++]);

      if (!(Number.isInteger(numColumns) && numColumns >= 0)) {
        throw new XyzReaderError("invalid numColumns");
      }

      const property = { name, type, numColumns };

      properties.push(property);
    }
    return properties;
  }

  toAtom(line, properties) {
    const splits = line.split(/\s+/);

    const data = {};

    let splitIndex = 0;
    for (const property of properties) {
      const values = [];

      for (let i = 0; i < property.numColumns; i++) {
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

    return { species, pos, forces };
  }
}
