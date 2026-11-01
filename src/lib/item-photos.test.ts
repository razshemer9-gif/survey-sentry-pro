import { describe, expect, it } from "vitest";
import { itemPhotos, itemPhotosPatch } from "./item-photos";

describe("itemPhotos", () => {
  it("reads a report written when an item had one photo", () => {
    expect(itemPhotos({ photo: "a" })).toEqual(["a"]);
  });

  it("reads the first photo and the rest as one list", () => {
    expect(itemPhotos({ photo: "a", photos: ["b", "c"] })).toEqual(["a", "b", "c"]);
  });

  it("reads an item that keeps all of them in photos", () => {
    expect(itemPhotos({ photos: ["a", "b"] })).toEqual(["a", "b"]);
  });

  it("has nothing to show for an item with no photo", () => {
    expect(itemPhotos({})).toEqual([]);
    expect(itemPhotos({ photos: [] })).toEqual([]);
  });

  it("does not show the same photo twice", () => {
    expect(itemPhotos({ photo: "a", photos: ["a", "b"] })).toEqual(["a", "b"]);
  });
});

describe("itemPhotosPatch", () => {
  // The first photo stays in `photo`, so a report saved with several photos
  // still shows one in a build that never heard of the rest.
  it("keeps the first photo where a single photo has always been", () => {
    expect(itemPhotosPatch(["a", "b", "c"])).toEqual({ photo: "a", photos: ["b", "c"] });
  });

  it("leaves no empty list behind for a single photo", () => {
    expect(itemPhotosPatch(["a"])).toEqual({ photo: "a", photos: undefined });
  });

  it("clears both fields when the last photo is removed", () => {
    expect(itemPhotosPatch([])).toEqual({ photo: undefined, photos: undefined });
  });

  it("round-trips whatever was read", () => {
    for (const item of [{ photo: "a" }, { photo: "a", photos: ["b"] }, { photos: ["a", "b", "c"] }, {}]) {
      const list = itemPhotos(item);
      expect(itemPhotos(itemPhotosPatch(list))).toEqual(list);
    }
  });
});
