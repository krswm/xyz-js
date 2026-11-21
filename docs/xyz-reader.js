// I referred to this specification of the XYZ and Extended XYZ formats:
// https://www.ovito.org/docs/current/reference/file_formats/input/xyz.html

export class XyzReaderError extends Error {}

export class XyzReader {
  constructor(fileContent) {
    console.log("%c%s", "font-family: ui-monospace;", fileContent);

    this.lines = fileContent.split(/\n|\r\n/);

    while (true) {
      const lastLine = this.lines.pop();
      if (lastLine !== "") {
        this.lines.push(lastLine);
        break;
      }
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
    const splits = line.trim().split(/\s+/);

    const data = {};
    let splitIndex = 0;
    for (const property of properties) {
      if (splitIndex + property.numColumns > splits.len) {
        break;
      }

      const values = [];
      for (let i = 0; i < property.numColumns; i++) {
        const value = splits[splitIndex++];
        if (value === undefined) {
          break;
        }

        switch (property.type) {
          case "S": // String
            values.push(value);
            break;
          case "I": // Integer
          case "R": // Real
          case "L": // Logical
            values.push(Number(value));
            break;
        }
      }
      data[property.name] = values;
    }

    const dataSpecies = data.species || [];
    const dataPos = data.pos || [];
    const dataForces = data.forces || data.MACE_forces || data.force || [];

    const species =
      typeof data.species[0] === "string" && dataSpecies.length === 1
        ? data.species[0]
        : undefined;
    const pos =
      typeof dataPos[0] === "number" && dataPos.length === 3
        ? dataPos
        : undefined;
    const forces =
      typeof dataForces[0] === "number" && dataForces.length === 3
        ? dataForces
        : undefined;

    return { species, pos, forces };
  }
}
