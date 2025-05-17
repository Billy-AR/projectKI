import { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox"; // Import Checkbox from ShadCN
import { Label } from "./ui/label";
import type { LocationKeyGeneratorProps, LocationKeyOptions } from "../Types";
import { generateLocationKey } from "../lib/steganography";

const LocationKeyGenerator: React.FC<LocationKeyGeneratorProps> = ({ onKeyGenerated, disabled = false }) => {
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [keyOptions, setKeyOptions] = useState<LocationKeyOptions>({
    length: 16,
    includeUppercase: true, // boolean value
    includeNumbers: true, // boolean value
    includeSymbols: false, // boolean value
  });

  const handleGenerate = () => {
    const key = generateLocationKey(keyOptions.length, keyOptions.includeUppercase, keyOptions.includeNumbers, keyOptions.includeSymbols);
    onKeyGenerated(key);
    setDialogOpen(false);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="whitespace-nowrap bg-blue-600/20 border-blue-500/30 text-blue-300 hover:bg-blue-600/30 hover:border-blue-500/50 hover:text-blue-200" disabled={disabled}>
          Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700 rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-blue-100">Generator Kunci Lokasi</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-blue-100">Panjang Kunci</Label>
              <span className="text-sm font-mono bg-slate-700/60 px-2 py-1 rounded text-blue-300">{keyOptions.length}</span>
            </div>
            <Slider value={[keyOptions.length]} min={8} max={32} step={1} onValueChange={(value) => setKeyOptions({ ...keyOptions, length: value[0] })} className="py-1" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-700/30 p-3 rounded-lg">
              <Label htmlFor="uppercase" className="text-blue-100">
                Huruf Kapital
              </Label>
              <Checkbox
                id="uppercase"
                checked={keyOptions.includeUppercase} // Ensure this is a boolean value
                onCheckedChange={(checked: boolean) => setKeyOptions({ ...keyOptions, includeUppercase: checked })}
                className="bg-white checked:bg-blue-700 checked:ring-2 checked:ring-blue-300 checked:focus:ring-4 checked:focus:ring-blue-500 border-transparent focus:ring-4 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-700/30 p-3 rounded-lg">
              <Label htmlFor="numbers" className="text-blue-100">
                Angka
              </Label>
              <Checkbox
                id="numbers"
                checked={keyOptions.includeNumbers} // Ensure this is a boolean value
                onCheckedChange={(checked: boolean) => setKeyOptions({ ...keyOptions, includeNumbers: checked })}
                className="bg-white checked:bg-blue-700 checked:ring-2 checked:ring-blue-300 checked:focus:ring-4 checked:focus:ring-blue-500 border-transparent focus:ring-4 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-700/30 p-3 rounded-lg">
              <Label htmlFor="symbols" className="text-blue-100">
                Simbol
              </Label>
              <Checkbox
                id="symbols"
                checked={keyOptions.includeSymbols} // Ensure this is a boolean value
                onCheckedChange={(checked: boolean) => setKeyOptions({ ...keyOptions, includeSymbols: checked })}
                className="bg-white checked:bg-blue-700 checked:ring-2 checked:ring-blue-300 checked:focus:ring-4 checked:focus:ring-blue-500 border-transparent focus:ring-4 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        <Button onClick={handleGenerate} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 rounded-lg transition-all">
          Generate Kunci
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default LocationKeyGenerator;
