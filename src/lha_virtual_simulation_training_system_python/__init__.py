"""Package entry delegates to root main (flat module layout)."""


def main() -> None:
    from main import main as _main

    _main()
