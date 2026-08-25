{
  description = "helping hand monorepo";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forEachSystem = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      devShells = forEachSystem (system:
        let
          pkgs = import nixpkgs {
            inherit system;
            config.allowUnfree = true;
          };
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_22
              flutter
              docker-compose
              android-studio
              jdk17
            ];
            nativeBuildInputs = with pkgs; [
              pkg-config
              cmake
              ninja
              clang
            ];
            buildInputs = with pkgs; [
              gtk3
              glib
              pcre2
              libxkbcommon
              gst_all_1.gstreamer
              gst_all_1.gst-plugins-base
              gst_all_1.gst-plugins-good
              libunwind
            ];
            
            # Force Android Emulator to use system libraries for OpenGL/Vulkan
            # This prevents it from falling back to SwiftShader (CPU rendering) which causes massive lag
            ANDROID_EMULATOR_USE_SYSTEM_LIBS = "1";
          };
        }
      );
    };
}
